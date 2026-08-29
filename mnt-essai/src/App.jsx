import React, { useEffect, useMemo, useState } from 'react'
import { db, functions } from './firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'

/* ============================================================
   CONFIGURATION
   La liste des cours n'est PLUS lue directement depuis Firestore
   côté client (ce document contient aussi des mots de passe et des
   données élèves). Elle passe par la Cloud Function "getTrialCourses"
   (voir /functions/index.js) qui ne renvoie que les champs nécessaires.
   ============================================================ */
const CONFIG = {
  // Collections séparées (au premier niveau de la base) pour cette appli
  bookingsCollection: 'essai_reservations',
  mailCollection: 'mail',
  adminEmail: 'contact@mntstudiodance.fr', // ⚠️ à remplacer par la vraie adresse
  weeksAhead: 2,
  // Aucune date proposée avant cette date, même si le jour de la semaine
  // tomberait plus tôt. Une fois cette date passée, le calcul revient
  // naturellement à "aujourd'hui" — rien à modifier après la rentrée.
  minStartDate: new Date(2026, 8, 14), // 14 septembre 2026 (mois 0-indexé)
}

const FRENCH_DAYS = [
  'Dimanche',
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
]

function normalizeDayToIndex(day) {
  if (typeof day === 'number') return day
  if (typeof day === 'string') {
    const idx = FRENCH_DAYS.findIndex(
      (d) => d.toLowerCase() === day.trim().toLowerCase()
    )
    if (idx !== -1) return idx
    const asNum = parseInt(day, 10)
    if (!Number.isNaN(asNum)) return asNum
  }
  return null
}

function nextOccurrences(dayIndex, count) {
  const results = []
  if (dayIndex === null || dayIndex === undefined) return results
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const minStart = new Date(CONFIG.minStartDate)
  minStart.setHours(0, 0, 0, 0)
  // Jamais avant aujourd'hui, jamais avant la date de départ configurée
  const base = today > minStart ? today : minStart
  let cursor = new Date(base)
  const diff = (dayIndex - cursor.getDay() + 7) % 7
  cursor.setDate(cursor.getDate() + diff)
  for (let i = 0; i < count; i++) {
    results.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 7)
  }
  return results
}

function formatDateFR(date) {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

const PHONE_RE = /^(?:\+33|0)[1-9](?:[\s.-]?\d{2}){4}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function App() {
  const [step, setStep] = useState(0)
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [selectedCourses, setSelectedCourses] = useState([])
  const [selectedDates, setSelectedDates] = useState({})
  const [form, setForm] = useState({
    prenom: '',
    nom: '',
    telephone: '',
    email: '',
  })
  const [formErrors, setFormErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    async function loadCourses() {
      try {
        const getTrialCourses = httpsCallable(functions, 'getTrialCourses')
        const result = await getTrialCourses()
        const rawCourses = result.data.courses || []

        const list = rawCourses.map((c) => ({
          id: c.id,
          name: c.name,
          dayIndex: normalizeDayToIndex(c.day),
          dayLabel:
            typeof c.day === 'string'
              ? c.day
              : FRENCH_DAYS[normalizeDayToIndex(c.day)] || '',
          site: c.site,
          venue: c.venue,
          teacher: c.teacher,
          time: c.time,
        }))

        setCourses(list)
      } catch (err) {
        console.error(err)
        setLoadError(
          "Impossible de charger les cours pour le moment. Vérifie que la Cloud Function getTrialCourses est bien déployée (voir README)."
        )
      } finally {
        setLoading(false)
      }
    }
    loadCourses()
  }, [])

  const coursesBySite = useMemo(() => {
    const groups = {}
    for (const c of courses) {
      const key = c.site || 'Autre'
      if (!groups[key]) groups[key] = []
      groups[key].push(c)
    }
    return groups
  }, [courses])

  function toggleCourse(course) {
    if (course.full) return
    setSelectedCourses((prev) => {
      const exists = prev.find((c) => c.id === course.id)
      if (exists) {
        const next = prev.filter((c) => c.id !== course.id)
        setSelectedDates((d) => {
          const copy = { ...d }
          delete copy[course.id]
          return copy
        })
        return next
      }
      return [...prev, course]
    })
  }

  function validateForm() {
    const errs = {}
    if (!form.prenom.trim()) errs.prenom = 'Le prénom est requis.'
    if (!form.nom.trim()) errs.nom = 'Le nom est requis.'
    if (!form.telephone.trim()) {
      errs.telephone = 'Le téléphone est requis.'
    } else if (!PHONE_RE.test(form.telephone.trim())) {
      errs.telephone = 'Format de téléphone invalide (ex: 06 12 34 56 78).'
    }
    if (!form.email.trim()) {
      errs.email = "L'adresse email est requise."
    } else if (!EMAIL_RE.test(form.email.trim())) {
      errs.email = 'Adresse email invalide.'
    }
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const reservationCourses = selectedCourses.map((c) => ({
        courseId: c.id,
        nom: c.name,
        site: c.site,
        venue: c.venue,
        professeur: c.teacher,
        horaire: c.time,
        date: formatDateFR(selectedDates[c.id]),
        dateISO: selectedDates[c.id].toISOString(),
      }))

      await addDoc(collection(db, CONFIG.bookingsCollection), {
        prenom: form.prenom.trim(),
        nom: form.nom.trim(),
        telephone: form.telephone.trim(),
        email: form.email.trim(),
        cours: reservationCourses,
        createdAt: serverTimestamp(),
      })

      const coursListHTML = reservationCourses
        .map(
          (c) =>
            `<li><strong>${c.nom}</strong> — ${c.date} à ${c.horaire}${
              c.site ? ` (${c.site})` : ''
            }${c.professeur ? `, avec ${c.professeur}` : ''}</li>`
        )
        .join('')

      await addDoc(collection(db, CONFIG.mailCollection), {
        to: [CONFIG.adminEmail],
        message: {
          subject: `Nouvelle réservation d'essai — ${form.prenom} ${form.nom}`,
          html: `
            <div style="font-family:Arial,sans-serif;color:#1a1a1a">
              <h2 style="color:#c2185b">Nouvelle réservation de cours d'essai</h2>
              <p><strong>${form.prenom} ${form.nom}</strong></p>
              <p>Téléphone : ${form.telephone}<br/>Email : ${form.email}</p>
              <p><strong>Cours réservé(s) :</strong></p>
              <ul>${coursListHTML}</ul>
            </div>
          `,
        },
      })

      await addDoc(collection(db, CONFIG.mailCollection), {
        to: [form.email.trim()],
        message: {
          subject: 'Votre cours d’essai chez MNT Studio Dance est confirmé !',
          html: `
            <div style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:520px;margin:auto">
              <div style="background:#0a0908;padding:24px;text-align:center">
                <h1 style="color:#d4af37;font-family:Georgia,serif;letter-spacing:2px;margin:0">MNT STUDIO DANCE</h1>
              </div>
              <div style="padding:24px;border:1px solid #eee;border-top:none">
                <h2 style="color:#c2185b">C'est confirmé, ${form.prenom} !</h2>
                <p>Votre cours d'essai est réservé. Voici le récapitulatif :</p>
                <ul>${coursListHTML}</ul>
                <p>Pensez à arriver 10 minutes en avance, en tenue confortable.</p>
                <p style="margin-top:24px">À très vite sur le dancefloor,<br/>L'équipe MNT Studio Dance</p>
              </div>
            </div>
          `,
        },
      })

      setStep(5)
    } catch (err) {
      console.error(err)
      setSubmitError(
        "La réservation n'a pas pu être enregistrée. Réessaie dans un instant."
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-stage-black text-white font-body relative overflow-x-hidden">
      <BackgroundGlow />
      <Header step={step} />

      <main className="relative z-10 max-w-3xl mx-auto px-5 pb-24">
        {step === 0 && <HeroStep onStart={() => setStep(1)} />}

        {step === 1 && (
          <CoursesStep
            loading={loading}
            loadError={loadError}
            coursesBySite={coursesBySite}
            selectedCourses={selectedCourses}
            onToggle={toggleCourse}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        )}

        {step === 2 && (
          <DatesStep
            selectedCourses={selectedCourses}
            selectedDates={selectedDates}
            setSelectedDates={setSelectedDates}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <InfosStep
            form={form}
            setForm={setForm}
            errors={formErrors}
            onNext={() => {
              if (validateForm()) setStep(4)
            }}
            onBack={() => setStep(2)}
          />
        )}

        {step === 4 && (
          <RecapStep
            form={form}
            selectedCourses={selectedCourses}
            selectedDates={selectedDates}
            submitting={submitting}
            submitError={submitError}
            onConfirm={handleSubmit}
            onBack={() => setStep(3)}
          />
        )}

        {step === 5 && <SuccessStep form={form} />}
      </main>
    </div>
  )
}

/* ---------------- Sous-composants ---------------- */

function BackgroundGlow() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[560px] h-[560px] rounded-full bg-magenta/20 blur-[120px] animate-spotPulse" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-gold/10 blur-[100px]" />
    </div>
  )
}

function Header({ step }) {
  return (
    <header className="relative z-10 max-w-3xl mx-auto px-5 pt-8 pb-4">
      <p className="font-display text-2xl tracking-[0.15em] text-gold-soft text-center">
        MNT STUDIO DANCE
      </p>
      {step > 0 && step < 5 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === step
                  ? 'w-8 bg-magenta-bright'
                  : s < step
                  ? 'w-4 bg-gold'
                  : 'w-4 bg-white/15'
              }`}
            />
          ))}
        </div>
      )}
    </header>
  )
}

function HeroStep({ onStart }) {
  return (
    <div className="animate-riseIn text-center pt-10">
      <h1 className="font-display text-6xl sm:text-7xl leading-[0.95] tracking-wide">
        <span className="text-white">TON PREMIER</span>
        <br />
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-magenta-bright to-gold">
          COURS D'ESSAI
        </span>
      </h1>
      <p className="mt-6 text-white/70 text-lg max-w-md mx-auto">
        Gratuit, sans engagement. Choisis ton cours, ta date, et monte sur
        scène avec nous.
      </p>
      <button
        onClick={onStart}
        className="mt-10 px-10 py-4 rounded-full bg-magenta-bright font-semibold tracking-wide shadow-glow hover:bg-magenta transition-all hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        Réserver mon cours d'essai
      </button>
    </div>
  )
}

function CoursesStep({
  loading,
  loadError,
  coursesBySite,
  selectedCourses,
  onToggle,
  onNext,
  onBack,
}) {
  const isSelected = (id) => selectedCourses.some((c) => c.id === id)

  return (
    <div className="animate-riseIn">
      <StepTitle
        eyebrow="Étape 1"
        title="Choisis ton ou tes cours"
        subtitle="Sélection multiple possible."
      />

      {loading && <p className="text-white/60 text-center py-10">Chargement des cours…</p>}
      {loadError && (
        <p className="text-magenta-bright text-center py-10">{loadError}</p>
      )}

      {!loading &&
        !loadError &&
        Object.entries(coursesBySite).map(([site, list]) => (
          <div key={site} className="mb-8">
            <h3 className="font-display text-xl tracking-wide text-gold-soft mb-3">
              {site}
            </h3>
            <div className="grid gap-3">
              {list.map((course) => (
                <button
                  key={course.id}
                  onClick={() => onToggle(course)}
                  disabled={course.full}
                  className={`text-left p-4 rounded-2xl border transition-all ${
                    course.full
                      ? 'border-white/5 bg-white/[0.02] opacity-50 cursor-not-allowed'
                      : isSelected(course.id)
                      ? 'border-magenta-bright bg-magenta-deep/30 shadow-glow'
                      : 'border-white/10 bg-white/5 hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-lg flex items-center gap-2">
                      {course.name}
                      {course.full && (
                        <span className="text-xs font-semibold tracking-wide uppercase bg-magenta-deep/60 text-white/80 px-2 py-0.5 rounded-full">
                          Complet
                        </span>
                      )}
                    </span>
                    {!course.full && (
                      <span
                        className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                          isSelected(course.id)
                            ? 'bg-magenta-bright border-magenta-bright'
                            : 'border-white/30'
                        }`}
                      >
                        {isSelected(course.id) && (
                          <span className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </span>
                    )}
                  </div>
                  <p className="text-white/60 text-sm mt-1">
                    {course.dayLabel} · {course.time}
                    {course.venue ? ` · ${course.venue}` : ''}
                    {course.teacher ? ` · ${course.teacher}` : ''}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ))}

      {!loading && !loadError && Object.keys(coursesBySite).length === 0 && (
        <p className="text-white/60 text-center py-10">
          Aucun cours disponible pour le moment.
        </p>
      )}

      <NavButtons
        onBack={onBack}
        onNext={onNext}
        nextDisabled={selectedCourses.length === 0}
      />
    </div>
  )
}

function DatesStep({
  selectedCourses,
  selectedDates,
  setSelectedDates,
  onNext,
  onBack,
}) {
  const allChosen = selectedCourses.every((c) => selectedDates[c.id])

  return (
    <div className="animate-riseIn">
      <StepTitle
        eyebrow="Étape 2"
        title="Choisis ta date"
        subtitle="Uniquement les jours où le cours a réellement lieu."
      />

      <div className="space-y-8">
        {selectedCourses.map((course) => {
          const options = nextOccurrences(course.dayIndex, CONFIG.weeksAhead)
          return (
            <div key={course.id}>
              <h3 className="font-semibold text-lg mb-3">{course.name}</h3>
              <div className="grid grid-cols-2 gap-3">
                {options.map((date) => {
                  const isSel =
                    selectedDates[course.id]?.toDateString() ===
                    date.toDateString()
                  return (
                    <button
                      key={date.toISOString()}
                      onClick={() =>
                        setSelectedDates((prev) => ({
                          ...prev,
                          [course.id]: date,
                        }))
                      }
                      className={`p-4 rounded-xl border text-left transition-all ${
                        isSel
                          ? 'border-gold bg-gold/10 shadow-goldglow'
                          : 'border-white/10 bg-white/5 hover:border-white/25'
                      }`}
                    >
                      <p className="capitalize font-medium">
                        {formatDateFR(date)}
                      </p>
                      <p className="text-white/50 text-sm mt-0.5">
                        {course.time}
                      </p>
                    </button>
                  )
                })}
                {options.length === 0 && (
                  <p className="text-white/50 text-sm col-span-2">
                    Aucune date trouvée pour ce cours — vérifie le champ
                    "day" pour ce cours dans Firestore.
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <NavButtons onBack={onBack} onNext={onNext} nextDisabled={!allChosen} />
    </div>
  )
}

function InfosStep({ form, setForm, errors, onNext, onBack }) {
  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="animate-riseIn">
      <StepTitle
        eyebrow="Étape 3"
        title="Tes coordonnées"
        subtitle="Pour te confirmer ta place."
      />

      <div className="space-y-4">
        <FormField
          label="Prénom"
          value={form.prenom}
          onChange={(v) => update('prenom', v)}
          error={errors.prenom}
          autoComplete="given-name"
        />
        <FormField
          label="Nom"
          value={form.nom}
          onChange={(v) => update('nom', v)}
          error={errors.nom}
          autoComplete="family-name"
        />
        <FormField
          label="Téléphone"
          value={form.telephone}
          onChange={(v) => update('telephone', v)}
          error={errors.telephone}
          type="tel"
          placeholder="06 12 34 56 78"
          autoComplete="tel"
        />
        <FormField
          label="Adresse email"
          value={form.email}
          onChange={(v) => update('email', v)}
          error={errors.email}
          type="email"
          placeholder="prenom@exemple.fr"
          autoComplete="email"
        />
      </div>

      <NavButtons onBack={onBack} onNext={onNext} />
    </div>
  )
}

function FormField({ label, value, onChange, error, type = 'text', placeholder, autoComplete }) {
  return (
    <div>
      <label className="block text-sm text-white/60 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-white placeholder-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold transition-colors ${
          error ? 'border-magenta-bright' : 'border-white/15 focus:border-gold'
        }`}
      />
      {error && <p className="text-magenta-bright text-sm mt-1">{error}</p>}
    </div>
  )
}

function RecapStep({
  form,
  selectedCourses,
  selectedDates,
  submitting,
  submitError,
  onConfirm,
  onBack,
}) {
  return (
    <div className="animate-riseIn">
      <StepTitle
        eyebrow="Étape 4"
        title="Vérifie et confirme"
        subtitle="Un mail de confirmation te sera envoyé."
      />

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
        <div>
          <p className="text-white/50 text-sm">Élève</p>
          <p className="font-medium">
            {form.prenom} {form.nom}
          </p>
          <p className="text-white/70 text-sm">
            {form.telephone} · {form.email}
          </p>
        </div>
        <div className="border-t border-white/10 pt-4 space-y-3">
          {selectedCourses.map((c) => (
            <div key={c.id} className="flex justify-between items-start">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-white/50 text-sm">
                  {c.site}
                  {c.teacher ? ` · ${c.teacher}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="capitalize text-gold-soft text-sm">
                  {formatDateFR(selectedDates[c.id])}
                </p>
                <p className="text-white/50 text-sm">{c.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {submitError && (
        <p className="text-magenta-bright text-sm mt-4 text-center">
          {submitError}
        </p>
      )}

      <NavButtons
        onBack={onBack}
        onNext={onConfirm}
        nextLabel={submitting ? 'Envoi…' : 'Confirmer ma réservation'}
        nextDisabled={submitting}
      />
    </div>
  )
}

function SuccessStep({ form }) {
  return (
    <div className="animate-riseIn text-center pt-16">
      <div className="w-16 h-16 rounded-full bg-gold/15 border border-gold flex items-center justify-center mx-auto mb-6">
        <svg viewBox="0 0 24 24" className="w-8 h-8 text-gold" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="font-display text-4xl tracking-wide text-gold-soft">
        C'est réservé, {form.prenom} !
      </h2>
      <p className="text-white/70 mt-4 max-w-sm mx-auto">
        Un email de confirmation vient de t'être envoyé à {form.email}.
        À très vite sur le dancefloor.
      </p>
    </div>
  )
}

function StepTitle({ eyebrow, title, subtitle }) {
  return (
    <div className="mb-6">
      <p className="text-magenta-bright text-sm tracking-widest uppercase mb-1">
        {eyebrow}
      </p>
      <h2 className="font-display text-4xl tracking-wide">{title}</h2>
      {subtitle && <p className="text-white/50 mt-1">{subtitle}</p>}
    </div>
  )
}

function NavButtons({ onBack, onNext, nextDisabled, nextLabel = 'Continuer' }) {
  return (
    <div className="flex items-center justify-between mt-8">
      <button
        onClick={onBack}
        className="px-5 py-3 rounded-full text-white/60 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        ← Retour
      </button>
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="px-8 py-3 rounded-full bg-magenta-bright font-semibold tracking-wide shadow-glow hover:bg-magenta transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        {nextLabel}
      </button>
    </div>
  )
}
