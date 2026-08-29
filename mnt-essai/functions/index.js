const { onCall } = require('firebase-functions/v2/https')
const admin = require('firebase-admin')

admin.initializeApp()
const db = admin.firestore()

const DATA_COLLECTION = 'mnt-studio'
const DATA_DOC_ID = 'mnt-studio-data-v2'

// Document séparé, modifiable directement dans la console Firebase, pour
// marquer certains cours comme "complet" sans toucher au code ni à la
// base de données principale. Structure attendue :
// essai_config/settings { fullCourseIds: ["sugflltb", "..."] }
const CONFIG_COLLECTION = 'essai_config'
const CONFIG_DOC_ID = 'settings'

// Renvoie UNIQUEMENT les champs nécessaires à l'appli publique de
// réservation de cours d'essai : jamais les mots de passe, jamais les
// données élèves. C'est la seule porte d'entrée publique vers ces données.
exports.getTrialCourses = onCall(
  { region: 'europe-west1', cors: true },
  async () => {
    const [snap, configSnap] = await Promise.all([
      db.collection(DATA_COLLECTION).doc(DATA_DOC_ID).get(),
      db.collection(CONFIG_COLLECTION).doc(CONFIG_DOC_ID).get(),
    ])

    if (!snap.exists) {
      return { courses: [] }
    }

    const fullCourseIds = configSnap.exists
      ? configSnap.data().fullCourseIds || []
      : []

    const data = snap.data()
    const rawCourses = data.courses || []
    const rawTeachers = data.teachers || []

    const teacherNameById = {}
    for (const t of rawTeachers) {
      if (t && t.id) teacherNameById[t.id] = t.name
    }

    const courses = rawCourses.map((c, i) => {
      const teacherIds = c.teacherIds || []
      const teacherNames = teacherIds
        .map((id) => teacherNameById[id])
        .filter(Boolean)
      const id = c.id || `course-${i}`
      return {
        id,
        name: c.name || 'Cours',
        day: c.day || '',
        site: c.site || '',
        venue: c.venue || '',
        time: c.time || '',
        teacher: teacherNames.join(' & '),
        full: fullCourseIds.includes(id),
      }
    })

    return { courses }
  }
)
