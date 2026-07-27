// firebase-config.js

class DatabaseService {
    constructor() {
        this.app = null;
        this.db = null;
        this.useFirebase = false;
        this.init();
    }

    init() {
        try {
            const hardcodedConfig = {
              "apiKey": "AIzaSyDmWKtIyUwL0wU4YwP8CQz9IGnfYUYmSh8",
              "authDomain": "universty-3d00b.firebaseapp.com",
              "projectId": "universty-3d00b",
              "storageBucket": "universty-3d00b.firebasestorage.app",
              "messagingSenderId": "15684060530",
              "appId": "1:15684060530:web:90a75e02953d36d6aa89eb",
              "measurementId": "G-17LZ3EV7E9"
            };
            
            const configStr = localStorage.getItem('firebaseConfig');
            const firebaseConfig = hardcodedConfig || (configStr ? JSON.parse(configStr) : null);
            
            if (firebaseConfig) {
                // Check if app already initialized
                if (!firebase.apps.length) {
                    firebase.initializeApp(firebaseConfig);
                }
                this.db = firebase.firestore();
                this.useFirebase = true;
                console.log("Firebase initialized successfully.");
            } else {
                console.log("No Firebase config found. Using LocalStorage as fallback.");
                this.useFirebase = false;
            }
        } catch (error) {
            console.error("Error initializing Firebase:", error);
            this.useFirebase = false;
        }
    }

    async saveConfig(configString) {
        try {
            JSON.parse(configString);
            localStorage.setItem('firebaseConfig', configString);
            this.init(); // re-init
            return true;
        } catch (e) {
            return false;
        }
    }

    // Subjects
    async getSubjects() {
        if (this.useFirebase && this.db) {
            const snapshot = await this.db.collection('subjects').get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } else {
            return JSON.parse(localStorage.getItem('subjects') || '[]');
        }
    }

    async saveSubjects(subjectsArray) {
        if (this.useFirebase && this.db) {
            const batch = this.db.batch();
            // Delete all old subjects first to sync (simplistic sync)
            const snapshot = await this.db.collection('subjects').get();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            
            subjectsArray.forEach(subject => {
                const ref = this.db.collection('subjects').doc(subject.id.toString());
                batch.set(ref, subject);
            });
            await batch.commit();
        } else {
            localStorage.setItem('subjects', JSON.stringify(subjectsArray));
        }
    }

    // Students
    async getStudents(subjectId) {
        if (!subjectId) return [];
        if (this.useFirebase && this.db) {
            const snapshot = await this.db.collection(`subjects/${subjectId}/students`).get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } else {
            return JSON.parse(localStorage.getItem(`students_${subjectId}`) || '[]');
        }
    }

    async saveStudents(subjectId, studentsArray) {
        if (!subjectId) return;
        if (this.useFirebase && this.db) {
            const batch = this.db.batch();
            
            // First, clear existing students for this subject to do a full replace
            const snapshot = await this.db.collection(`subjects/${subjectId}/students`).get();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            
            // Then, add the new ones
            studentsArray.forEach(student => {
                const studentRef = this.db.collection(`subjects/${subjectId}/students`).doc(student.id.toString());
                batch.set(studentRef, student);
            });
            
            await batch.commit();
        } else {
            localStorage.setItem(`students_${subjectId}`, JSON.stringify(studentsArray));
        }
    }

    async clearStudents() {
        if (this.useFirebase && this.db) {
            const snapshot = await this.db.collection('students').get();
            const batch = this.db.batch();
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
        } else {
            localStorage.removeItem('students');
        }
    }

    // Attendance Records - Now nested under Subjects
    // Structure: attendance_v2 / {subjectId} / dates / {date}
    
    async saveAttendance(subjectId, date, records) {
        if (!subjectId) throw new Error('Subject ID is required');
        
        if (this.useFirebase && this.db) {
            const dateRef = this.db.collection(`attendance_v2/${subjectId}/dates`).doc(date);
            await dateRef.set({ records }, { merge: true });
        } else {
            const allAttendance = JSON.parse(localStorage.getItem('attendance_v2') || '{}');
            if (!allAttendance[subjectId]) allAttendance[subjectId] = {};
            allAttendance[subjectId][date] = records;
            localStorage.setItem('attendance_v2', JSON.stringify(allAttendance));
        }
    }
    
    async getAllAttendance(subjectId) {
        if (!subjectId) return {};
        
        if (this.useFirebase && this.db) {
            const snapshot = await this.db.collection(`attendance_v2/${subjectId}/dates`).get();
            let all = {};
            snapshot.docs.forEach(doc => {
                all[doc.id] = doc.data().records;
            });
            return all;
        } else {
            const allAttendance = JSON.parse(localStorage.getItem('attendance_v2') || '{}');
            return allAttendance[subjectId] || {};
        }
    }

    // Grades
    async saveGrades(subjectId, gradesObj) {
        if (!subjectId) throw new Error('Subject ID is required');
        
        if (this.useFirebase && this.db) {
            const gradesRef = this.db.collection(`subjects/${subjectId}/grades`).doc('all');
            await gradesRef.set({ records: gradesObj }, { merge: true });
        } else {
            const allGrades = JSON.parse(localStorage.getItem('grades_v1') || '{}');
            allGrades[subjectId] = gradesObj;
            localStorage.setItem('grades_v1', JSON.stringify(allGrades));
        }
    }
    
    async getGrades(subjectId) {
        if (!subjectId) return {};
        
        if (this.useFirebase && this.db) {
            const doc = await this.db.collection(`subjects/${subjectId}/grades`).doc('all').get();
            if (doc.exists && doc.data().records) {
                return doc.data().records;
            }
            return {};
        } else {
            const allGrades = JSON.parse(localStorage.getItem('grades_v1') || '{}');
            return allGrades[subjectId] || {};
        }
    }

    // Materials (Metadata only)

    async saveMaterialMetadata(materialObj) {
        if (!this.useFirebase || !this.db) throw new Error("قاعدة البيانات غير مفعلة.");
        const ref = this.db.collection('materials').doc(materialObj.id);
        await ref.set(materialObj);
    }

    async getMaterials(subjectId) {
        if (!this.useFirebase || !this.db) return [];
        const snapshot = await this.db.collection('materials').where('subjectId', '==', subjectId).get();
        return snapshot.docs.map(doc => doc.data());
    }

    async deleteMaterial(materialObj) {
        if (!this.useFirebase || !this.db) throw new Error("قاعدة البيانات غير مفعلة.");
        
        // Delete Metadata from Firestore
        await this.db.collection('materials').doc(materialObj.id).delete();
    }
}

window.dbService = new DatabaseService();
