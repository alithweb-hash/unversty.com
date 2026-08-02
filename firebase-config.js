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
            try {
                const snapshot = await this.db.collection('subjects').get();
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (e) {
                console.warn("Firebase getSubjects failed, fallback to local:", e);
                return JSON.parse(localStorage.getItem('subjects') || '[]');
            }
        } else {
            return JSON.parse(localStorage.getItem('subjects') || '[]');
        }
    }

    async saveSubjects(subjectsArray) {
        localStorage.setItem('subjects', JSON.stringify(subjectsArray));
        if (this.useFirebase && this.db) {
            try {
                const batch = this.db.batch();
                const snapshot = await this.db.collection('subjects').get();
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                
                subjectsArray.forEach(subject => {
                    const ref = this.db.collection('subjects').doc(subject.id.toString());
                    batch.set(ref, subject);
                });
                await batch.commit();
            } catch (e) {
                console.error("Firebase saveSubjects error:", e);
            }
        }
    }

    // Students
    async getStudents(subjectId) {
        if (!subjectId) return [];
        if (this.useFirebase && this.db) {
            try {
                const snapshot = await this.db.collection(`subjects/${subjectId}/students`).get();
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (e) {
                console.warn("Firebase getStudents failed, fallback to local:", e);
                return JSON.parse(localStorage.getItem(`students_${subjectId}`) || '[]');
            }
        } else {
            return JSON.parse(localStorage.getItem(`students_${subjectId}`) || '[]');
        }
    }

    async saveStudents(subjectId, studentsArray) {
        if (!subjectId) return;
        localStorage.setItem(`students_${subjectId}`, JSON.stringify(studentsArray));
        if (this.useFirebase && this.db) {
            try {
                const batch = this.db.batch();
                const snapshot = await this.db.collection(`subjects/${subjectId}/students`).get();
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                
                studentsArray.forEach(student => {
                    const studentRef = this.db.collection(`subjects/${subjectId}/students`).doc(student.id.toString());
                    batch.set(studentRef, student);
                });
                
                await batch.commit();
            } catch (e) {
                console.error("Firebase saveStudents error:", e);
            }
        }
    }

    async clearStudents(subjectId) {
        if (!subjectId) throw new Error('Subject ID is required to clear students');
        localStorage.removeItem(`students_${subjectId}`);
        const allAttendance = JSON.parse(localStorage.getItem('attendance_v2') || '{}');
        delete allAttendance[subjectId];
        localStorage.setItem('attendance_v2', JSON.stringify(allAttendance));
        
        const allGrades = JSON.parse(localStorage.getItem('grades_v1') || '{}');
        delete allGrades[subjectId];
        localStorage.setItem('grades_v1', JSON.stringify(allGrades));

        if (this.useFirebase && this.db) {
            try {
                const batch = this.db.batch();
                const studentsSnapshot = await this.db.collection(`subjects/${subjectId}/students`).get();
                studentsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
                
                const attendanceSnapshot = await this.db.collection(`attendance_v2/${subjectId}/dates`).get();
                attendanceSnapshot.docs.forEach(doc => batch.delete(doc.ref));
                
                const gradesRef = this.db.collection(`subjects/${subjectId}/grades`).doc('all');
                batch.delete(gradesRef);
                
                await batch.commit();
            } catch (e) {
                console.error("Firebase clearStudents error:", e);
            }
        }
    }

    // Attendance Records
    async saveAttendance(subjectId, date, records) {
        if (!subjectId) throw new Error('Subject ID is required');
        
        const allAttendance = JSON.parse(localStorage.getItem('attendance_v2') || '{}');
        if (!allAttendance[subjectId]) allAttendance[subjectId] = {};
        allAttendance[subjectId][date] = records;
        localStorage.setItem('attendance_v2', JSON.stringify(allAttendance));

        if (this.useFirebase && this.db) {
            try {
                const dateRef = this.db.collection(`attendance_v2/${subjectId}/dates`).doc(date);
                await dateRef.set({ records }, { merge: true });
            } catch (e) {
                console.error("Firebase saveAttendance error:", e);
            }
        }
    }
    
    async getAllAttendance(subjectId) {
        if (!subjectId) return {};
        
        if (this.useFirebase && this.db) {
            try {
                const snapshot = await this.db.collection(`attendance_v2/${subjectId}/dates`).get();
                let all = {};
                snapshot.docs.forEach(doc => {
                    all[doc.id] = doc.data().records;
                });
                return all;
            } catch (e) {
                console.warn("Firebase getAllAttendance failed, fallback to local:", e);
                const allAttendance = JSON.parse(localStorage.getItem('attendance_v2') || '{}');
                return allAttendance[subjectId] || {};
            }
        } else {
            const allAttendance = JSON.parse(localStorage.getItem('attendance_v2') || '{}');
            return allAttendance[subjectId] || {};
        }
    }

    // Grades
    async saveGrades(subjectId, gradesObj) {
        if (!subjectId) throw new Error('Subject ID is required');
        
        const allGrades = JSON.parse(localStorage.getItem('grades_v1') || '{}');
        allGrades[subjectId] = gradesObj;
        localStorage.setItem('grades_v1', JSON.stringify(allGrades));

        if (this.useFirebase && this.db) {
            try {
                const gradesRef = this.db.collection(`subjects/${subjectId}/grades`).doc('all');
                await gradesRef.set({ records: gradesObj }, { merge: true });
            } catch (e) {
                console.error("Firebase saveGrades error:", e);
            }
        }
    }
    
    async getGrades(subjectId) {
        if (!subjectId) return {};
        
        if (this.useFirebase && this.db) {
            try {
                const doc = await this.db.collection(`subjects/${subjectId}/grades`).doc('all').get();
                if (doc.exists && doc.data().records) {
                    return doc.data().records;
                }
                return {};
            } catch (e) {
                console.warn("Firebase getGrades failed, fallback to local:", e);
                const allGrades = JSON.parse(localStorage.getItem('grades_v1') || '{}');
                return allGrades[subjectId] || {};
            }
        } else {
            const allGrades = JSON.parse(localStorage.getItem('grades_v1') || '{}');
            return allGrades[subjectId] || {};
        }
    }

    // Materials & Files Management (IndexedDB + Firebase Storage)
    
    async initIndexedDB() {
        if (!this.idb) {
            this.idb = new Promise((resolve, reject) => {
                const req = indexedDB.open('UniversityMaterialsDB', 1);
                req.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('files')) {
                        db.createObjectStore('files', { keyPath: 'id' });
                    }
                };
                req.onsuccess = (e) => resolve(e.target.result);
                req.onerror = (e) => reject(e.target.error);
            });
        }
        return this.idb;
    }

    async saveMaterialFileToIndexedDB(id, fileOrBlob, mimeType, fileName) {
        try {
            let blobToStore = fileOrBlob;
            if (fileOrBlob instanceof File || (fileOrBlob.arrayBuffer && typeof fileOrBlob.arrayBuffer === 'function')) {
                const buffer = await fileOrBlob.arrayBuffer();
                blobToStore = new Blob([buffer], { type: mimeType || fileOrBlob.type || 'application/octet-stream' });
            }
            const db = await this.initIndexedDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(['files'], 'readwrite');
                const store = tx.objectStore('files');
                const req = store.put({ id, blob: blobToStore, mimeType: mimeType || fileOrBlob.type, fileName: fileName || fileOrBlob.name, date: Date.now() });
                req.onsuccess = () => resolve(true);
                req.onerror = (e) => reject(e.target.error);
            });
        } catch (e) {
            console.error("IndexedDB Save Error:", e);
            throw e;
        }
    }

    async getMaterialFileFromIndexedDB(id) {
        try {
            const db = await this.initIndexedDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(['files'], 'readonly');
                const store = tx.objectStore('files');
                const req = store.get(id);
                req.onsuccess = () => resolve(req.result ? req.result.blob : null);
                req.onerror = (e) => reject(e.target.error);
            });
        } catch (e) {
            console.error("IndexedDB Read Error:", e);
            return null;
        }
    }

    async deleteMaterialFileFromIndexedDB(id) {
        try {
            const db = await this.initIndexedDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(['files'], 'readwrite');
                const store = tx.objectStore('files');
                const req = store.delete(id);
                req.onsuccess = () => resolve(true);
                req.onerror = (e) => reject(e.target.error);
            });
        } catch (e) {
            console.error("IndexedDB Delete Error:", e);
        }
    }

    async saveMaterialMetadata(materialObj) {
        // Always save locally in localStorage as well
        const localMats = JSON.parse(localStorage.getItem('materials_v1') || '[]');
        const existingIdx = localMats.findIndex(m => m.id === materialObj.id);
        if (existingIdx !== -1) {
            localMats[existingIdx] = materialObj;
        } else {
            localMats.push(materialObj);
        }
        localStorage.setItem('materials_v1', JSON.stringify(localMats));

        if (this.useFirebase && this.db) {
            try {
                const ref = this.db.collection('materials').doc(materialObj.id);
                await Promise.race([
                    ref.set(materialObj),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Firestore metadata save timeout")), 3000))
                ]);
            } catch (e) {
                console.warn("Firestore saveMaterialMetadata failed or timed out:", e);
            }
        }
    }

    async uploadMaterialFile(id, file) {
        // 1. Guaranteed Local Save first to IndexedDB
        let localSaved = false;
        try {
            await this.saveMaterialFileToIndexedDB(id, file, file.type, file.name);
            localSaved = true;
        } catch (e) {
            console.error("Local IndexedDB save error:", e);
        }

        // 2. Try Firebase Storage with a 3-second max timeout
        if (this.useFirebase && window.firebase && firebase.storage) {
            try {
                const storageUploadPromise = (async () => {
                    const storageRef = firebase.storage().ref(`materials/${id}_${file.name}`);
                    const snapshot = await storageRef.put(file);
                    const downloadUrl = await snapshot.ref.getDownloadURL();
                    return {
                        url: downloadUrl,
                        storagePath: storageRef.fullPath,
                        isLocal: false
                    };
                })();

                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Firebase Storage timeout")), 3500)
                );

                const result = await Promise.race([storageUploadPromise, timeoutPromise]);
                return result;
            } catch (err) {
                console.warn("Firebase Storage upload skipped or timed out, using IndexedDB storage:", err);
            }
        }

        return {
            url: '',
            storagePath: '',
            isLocal: true
        };
    }

    async getMaterials(subjectId) {
        if (!subjectId) return [];
        let materials = [];
        if (this.useFirebase && this.db) {
            try {
                const snapshot = await this.db.collection('materials').where('subjectId', '==', subjectId).get();
                materials = snapshot.docs.map(doc => doc.data());
            } catch (e) {
                console.error("Error loading materials from Firebase, loading local:", e);
                const localMats = JSON.parse(localStorage.getItem('materials_v1') || '[]');
                materials = localMats.filter(m => m.subjectId === subjectId);
            }
        } else {
            const localMats = JSON.parse(localStorage.getItem('materials_v1') || '[]');
            materials = localMats.filter(m => m.subjectId === subjectId);
        }
        return materials;
    }

    async deleteMaterial(materialObj) {
        // Delete metadata from localStorage
        const localMats = JSON.parse(localStorage.getItem('materials_v1') || '[]');
        const updatedLocal = localMats.filter(m => m.id !== materialObj.id);
        localStorage.setItem('materials_v1', JSON.stringify(updatedLocal));

        // Delete from IndexedDB if stored locally
        if (materialObj.isLocal || !materialObj.url) {
            await this.deleteMaterialFileFromIndexedDB(materialObj.id);
        }

        // Delete from Firebase Storage & Firestore if stored on cloud
        if (this.useFirebase && this.db) {
            try {
                await this.db.collection('materials').doc(materialObj.id).delete();
                if (materialObj.storagePath && firebase.storage) {
                    await firebase.storage().ref(materialObj.storagePath).delete();
                }
            } catch (e) {
                console.error("Error deleting material from Firebase:", e);
            }
        }
    }
}

window.dbService = new DatabaseService();

