const { onCall } = require('firebase-functions/v2/https')
const admin = require('firebase-admin')

admin.initializeApp()
const db = admin.firestore()

const DATA_COLLECTION = 'mnt-studio'
const DATA_DOC_ID = 'mnt-studio-data-v2'

// Renvoie UNIQUEMENT les champs nécessaires à l'appli publique de
// réservation de cours d'essai : jamais les mots de passe, jamais les
// données élèves. C'est la seule porte d'entrée publique vers ces données.
exports.getTrialCourses = onCall(
  { region: 'europe-west1', cors: true },
  async () => {
    const snap = await db.collection(DATA_COLLECTION).doc(DATA_DOC_ID).get()
    if (!snap.exists) {
      return { courses: [] }
    }

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
      return {
        id: c.id || `course-${i}`,
        name: c.name || 'Cours',
        day: c.day || '',
        site: c.site || '',
        venue: c.venue || '',
        time: c.time || '',
        teacher: teacherNames.join(' & '),
      }
    })

    return { courses }
  }
)
