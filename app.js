// app.js

// State
let state = {
    students: [],
    subjects: [], // {id, name}
    currentSubject: '', // Selected subject ID
    attendance: {}, // Now specific to current subject: { '2023-10-01': { 'stu-id': 'present' } }
    materials: [], // { id, name, type (curriculum|exam), url, path, subjectId, date }
    grades: {}, // { 'stu-id': { quizzes: 10, final: 100, shortQuizzes: [10, 8, 9] } }
    numQuizzes: 3, // Default number of short quizzes
    totalLectures: parseInt(localStorage.getItem('totalLectures') || '15'),
    currentDate: new Date().toISOString().split('T')[0]
};

// DOM Elements
const els = {
    navLinks: document.querySelectorAll('.nav-links li'),
    views: document.querySelectorAll('.view'),
    firebaseConfigInput: document.getElementById('firebaseConfigInput'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    saveFirebaseBtn: document.getElementById('saveFirebaseBtn'),
    loader: document.getElementById('loaderOverlay'),
    toast: document.getElementById('toast'),
    
    // Subjects
    newSubjectInput: document.getElementById('newSubjectInput'),
    newStageInput: document.getElementById('newStageInput'),
    addSubjectBtn: document.getElementById('addSubjectBtn'),
    subjectsListContainer: document.getElementById('subjectsListContainer'),
    globalSubjectSelect: document.getElementById('globalSubjectSelect'),
    exportSubjectSelect: document.getElementById('exportSubjectSelect'),
    
    // Export Dates
    exportDateFrom: document.getElementById('exportDateFrom'),
    exportDateTo: document.getElementById('exportDateTo'),

    // Dashboard
    totalStudents: document.getElementById('totalStudents'),
    attendanceRate: document.getElementById('attendanceRate'),
    dangerStudents: document.getElementById('dangerStudents'),
    totalLecturesCount: document.getElementById('totalLecturesCount'),
    dangerTableBody: document.getElementById('dangerTableBody'),
    alertBadge: document.getElementById('alertBadge'),
    
    // Students
    studentsTableBody: document.getElementById('studentsTableBody'),
    clearStudentsBtn: document.getElementById('clearStudentsBtn'),
    
    // Attendance
    attendanceDate: document.getElementById('attendanceDate'),
    attendanceTableBody: document.getElementById('attendanceTableBody'),
    saveAttendanceBtn: document.getElementById('saveAttendanceBtn'),
    resetAttendanceBtn: document.getElementById('resetAttendanceBtn'),
    
    // Import/Export
    excelFileInput: document.getElementById('excelFileInput'),
    exportExcelBtn: document.getElementById('exportExcelBtn'),
    exportSheetsBtn: document.getElementById('exportSheetsBtn'),
    
    // Search
    searchInput: document.getElementById('searchInput'),
    
    // Warnings
    warningsTableBody: document.getElementById('warningsTableBody'),
    exportWarningsBtn: document.getElementById('exportWarningsBtn'),
    
    // Grades
    gradesTableBody: document.getElementById('gradesTableBody'),
    exportGradesBtn: document.getElementById('exportGradesBtn'),
    
    // Quizzes
    quizzesTableBody: document.getElementById('quizzesTableBody'),
    quizzesTableHeader: document.getElementById('quizzesTableHeader'),
    numQuizzesInput: document.getElementById('numQuizzesInput'),
    saveQuizzesBtn: document.getElementById('saveQuizzesBtn'),
    
    // Materials
    currNameInput: document.getElementById('currNameInput'),
    currUrlInput: document.getElementById('currUrlInput'),
    addCurrBtn: document.getElementById('addCurrBtn'),
    
    examNameInput: document.getElementById('examNameInput'),
    examUrlInput: document.getElementById('examUrlInput'),
    addExamBtn: document.getElementById('addExamBtn'),
    
    curriculumList: document.getElementById('curriculumList'),
    examsList: document.getElementById('examsList')
};

// Initialize App
async function init() {
    showLoader();
    try {
        const fbConfig = localStorage.getItem('firebaseConfig');
        if (fbConfig && els.firebaseConfigInput) els.firebaseConfigInput.value = fbConfig;
        if (els.attendanceDate) els.attendanceDate.value = state.currentDate;
        
        // Default dates for export (current month)
        const dateObj = new Date();
        if (els.exportDateFrom) els.exportDateFrom.value = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1).toISOString().split('T')[0];
        if (els.exportDateTo) els.exportDateTo.value = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0).toISOString().split('T')[0];
        
        await loadData();
        setupEvents();
    } catch (err) {
        console.error("Initialization Error:", err);
    } finally {
        hideLoader();
        renderAll();
    }
}

async function loadData() {
    state.subjects = await window.dbService.getSubjects();
    
    if (state.subjects.length > 0 && !state.currentSubject) {
        state.currentSubject = state.subjects[0].id;
    }
    
    if (state.currentSubject) {
        state.students = await window.dbService.getStudents(state.currentSubject);
        state.attendance = await window.dbService.getAllAttendance(state.currentSubject);
        state.grades = await window.dbService.getGrades(state.currentSubject);
        state.materials = await window.dbService.getMaterials(state.currentSubject);
    } else {
        state.attendance = {};
        state.grades = {};
        state.materials = [];
    }
}

// Event Listeners Setup
function setupEvents() {
    setupMaterialsEvents();
    els.navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const target = e.currentTarget.getAttribute('data-target');
            els.navLinks.forEach(l => l.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            els.views.forEach(v => v.classList.remove('active-view'));
            document.getElementById(target).classList.add('active-view');
            
            if (target === 'quizzes') renderQuizzes();
            
            renderAll();
        });
    });
    
    // Quizzes Events
    els.numQuizzesInput.addEventListener('change', (e) => {
        state.numQuizzes = parseInt(e.target.value) || 3;
        renderQuizzes();
    });
    
    els.saveQuizzesBtn.addEventListener('click', async () => {
        if (!state.currentSubject) return showToast('اختر مادة أولاً', 'error');
        showLoader();
        try {
            state.students.forEach(stu => {
                if (!state.grades[stu.id]) state.grades[stu.id] = {};
                let shortQuizzes = [];
                let sum = 0;
                for (let i = 1; i <= state.numQuizzes; i++) {
                    const input = document.querySelector(`.quiz-input[data-stu="${stu.id}"][data-quiz="${i}"]`);
                    const val = parseFloat(input.value) || 0;
                    shortQuizzes.push(val);
                    sum += val;
                }
                state.grades[stu.id].shortQuizzes = shortQuizzes;
                const average = sum / state.numQuizzes;
                state.grades[stu.id].quizzes = Math.round(average);
            });
            await window.dbService.saveGrades(state.currentSubject, state.grades);
            showToast('تم حفظ الاختبارات وتحديث درجات الاختبارات بنجاح', 'success');
            renderQuizzes();
        } catch(error) {
            console.error(error);
            showToast('خطأ في حفظ الاختبارات', 'error');
        } finally {
            hideLoader();
        }
    });

    if (els.resetAttendanceBtn) {
        els.resetAttendanceBtn.addEventListener('click', async () => {
            if (!state.currentSubject) return showToast('الرجاء اختيار مادة أولاً', 'error');
            if (confirm('هل أنت متأكد من مسح جميع سجلات الحضور لهذه المادة تماماً للبدء من جديد؟ (لا يمكن التراجع)')) {
                showLoader();
                try {
                    await window.dbService.clearAllAttendance(state.currentSubject);
                    state.attendance = {};
                    renderAll();
                    showToast('تم تصفير سجلات الحضور بنجاح', 'success');
                } catch (error) {
                    console.error(error);
                    showToast('حدث خطأ أثناء التصفير', 'error');
                } finally {
                    hideLoader();
                }
            }
        });
    }

    // Subject Management
    els.addSubjectBtn.addEventListener('click', async () => {
        const name = els.newSubjectInput.value.trim();
        const stage = (els.newStageInput ? els.newStageInput.value.trim() : '');
        
        if (name) {
            const newSubject = { id: `SUB-${Date.now()}`, name: name, stage: stage };
            state.subjects.push(newSubject);
            showLoader();
            try {
                await window.dbService.saveSubjects(state.subjects);
                els.newSubjectInput.value = '';
                if(els.newStageInput) els.newStageInput.value = '';
                
                // الانتقال فوراً للمادة والمرحلة الجديدة التي تم إنشاؤها
                state.currentSubject = newSubject.id;
                await loadData();
                
                showToast('تمت إضافة المادة والمرحلة بنجاح والانتقال إليها', 'success');
                renderAll();
            } catch (error) {
                console.error(error);
                showToast('حدث خطأ أثناء حفظ المادة', 'error');
                state.subjects.pop();
            } finally {
                hideLoader();
            }
        } else {
            showToast('الرجاء كتابة اسم المادة', 'error');
        }
    });

    els.globalSubjectSelect.addEventListener('change', async (e) => {
        state.currentSubject = e.target.value;
        showLoader();
        await loadData();
        hideLoader();
        renderAll();
    });

    // Settings
    if (els.saveSettingsBtn) {
        els.saveSettingsBtn.addEventListener('click', async () => {
            // Keep the fallback functionality if anything else uses this button
            showToast('تم حفظ الإعدادات بنجاح', 'success');
            renderAll();
        });
    }
    
    els.saveFirebaseBtn.addEventListener('click', async () => {
        const configStr = els.firebaseConfigInput.value.trim();
        if(!configStr) {
            localStorage.removeItem('firebaseConfig');
            window.dbService.init(); 
            showToast('تم التحويل للوضع المحلي', 'success');
            return;
        }
        
        const success = await window.dbService.saveConfig(configStr);
        if (success) {
            showToast('تم ربط قاعدة البيانات Firebase بنجاح', 'success');
            await loadData();
            renderAll();
        } else {
            showToast('خطأ في إعدادات Firebase', 'error');
        }
    });
    
    els.clearStudentsBtn.addEventListener('click', async () => {
        if (!state.currentSubject) {
            showToast('الرجاء اختيار المادة أولاً', 'error');
            return;
        }
        if(confirm('هل أنت متأكد من مسح جميع الطلبة؟ لا يمكن التراجع عن هذا الإجراء.')) {
            showLoader();
            await window.dbService.clearStudents(state.currentSubject);
            state.students = [];
            hideLoader();
            renderAll();
            showToast('تم مسح بيانات الطلبة', 'success');
        }
    });
    
    // Import/Export
    els.excelFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        showLoader();
        try {
            const newStudents = await window.ExcelService.importStudents(file);
            if (newStudents.length > 0) {
                const currentIds = state.students.map(s => s.id);
                const toAdd = newStudents.filter(ns => !currentIds.includes(ns.id));
                state.students = [...state.students, ...toAdd];
                
                await window.dbService.saveStudents(state.currentSubject, state.students);
                showToast(`تم استيراد ${toAdd.length} طالب بنجاح`, 'success');
                renderAll();
            } else {
                showToast('لم يتم العثور على طلبة في الملف', 'error');
            }
        } catch(err) {
            console.error(err);
            showToast('خطأ في قراءة ملف الإكسيل', 'error');
        }
        e.target.value = ''; 
        hideLoader();
    });
    
    const handleExport = async (type) => {
        const subjectId = els.exportSubjectSelect.value;
        if (!subjectId) {
            showToast('الرجاء اختيار المادة المراد تصديرها أولاً', 'error');
            return;
        }
        if (state.students.length === 0) {
            showToast('لا يوجد طلبة للتصدير', 'error');
            return;
        }
        
        const dateFrom = els.exportDateFrom.value;
        const dateTo = els.exportDateTo.value;
        if(!dateFrom || !dateTo) {
            showToast('الرجاء تحديد النطاق الزمني', 'error');
            return;
        }

        showLoader();
        try {
            const subAttendance = await window.dbService.getAllAttendance(subjectId);
            
            // Filter dates
            const filteredAttendance = {};
            Object.keys(subAttendance).forEach(date => {
                if (date >= dateFrom && date <= dateTo) {
                    filteredAttendance[date] = subAttendance[date];
                }
            });
            
            if (type === 'excel') {
                window.ExcelService.exportToExcel(state.students, filteredAttendance);
                showToast('تم التصدير بنجاح', 'success');
            } else {
                const customUrl = document.getElementById('sheetsUrlInput').value.trim();
                window.ExcelService.exportToGoogleSheets(state.students, filteredAttendance, customUrl);
            }
        } catch (error) {
            console.error(error);
            showToast('حدث خطأ أثناء جلب البيانات. تأكد من إعدادات Firestore.', 'error');
        } finally {
            hideLoader();
        }
    };

    els.exportExcelBtn.addEventListener('click', () => handleExport('excel'));
    els.exportSheetsBtn.addEventListener('click', () => handleExport('sheets'));
    
    // Export Warnings
    if (els.exportWarningsBtn) {
        els.exportWarningsBtn.addEventListener('click', async () => {
            if (!state.currentSubject) {
                showToast('الرجاء اختيار المادة أولاً', 'error');
                return;
            }
            
            // Gather warning data
            const dangerStudents = [];
            state.students.forEach((student, index) => {
                const abs = calculateAbsence(student.id);
                if (abs.count >= 2) {
                    dangerStudents.push({
                        seq: index + 1,
                        name: student.name,
                        absentCount: abs.count,
                        excusedCount: abs.excused
                    });
                }
            });
            
            if (dangerStudents.length === 0) {
                showToast('لا يوجد طلبة تجاوزوا نسبة الإنذار للتصدير', 'error');
                return;
            }
            
            // Export to Google Sheets
            const subject = state.subjects.find(s => s.id === state.currentSubject);
            const customUrl = subject ? subject.sheetsUrl : '';
            
            let headers = ['التسلسل', 'الاسم', 'أيام الغياب', 'الإجازات', 'التنبيه'];
            
            let tsvLines = [headers.join('\t')];
            let html = '<table border="1" style="border-collapse: collapse; font-family: sans-serif;">';
            html += '<thead><tr>';
            headers.forEach(h => html += `<th style="padding: 5px; background-color: #f3f4f6;">${h}</th>`);
            html += '</tr></thead><tbody>';
            
            dangerStudents.forEach(stu => {
                let rowTsv = [stu.seq, stu.name, stu.absentCount, stu.excusedCount, 'إنذار'];
                tsvLines.push(rowTsv.join('\t'));
                
                html += `<tr>`;
                html += `<td style="padding: 5px;">${stu.seq}</td>`;
                html += `<td style="padding: 5px; font-weight: bold;">${stu.name}</td>`;
                html += `<td style="padding: 5px; color: #dc2626;">${stu.absentCount}</td>`;
                html += `<td style="padding: 5px; color: #d97706;">${stu.excusedCount}</td>`;
                html += `<td style="padding: 5px; background-color: #fecaca; color: #dc2626; font-weight: bold;">إنذار</td>`;
                html += `</tr>`;
            });
            
            html += '</tbody></table>';
            const clipboardText = tsvLines.join('\n');
            
            const finishExport = () => {
                alert("تم نسخ تقرير الإنذارات بنجاح!\n\nقم بالذهاب إلى الشيت واضغط (Ctrl+V) للصق البيانات.");
                if (customUrl) {
                    window.open(customUrl, '_blank');
                } else {
                    window.open('https://sheets.new', '_blank');
                }
            };
    
            if (window.ClipboardItem) {
                try {
                    const htmlBlob = new Blob([html], { type: 'text/html' });
                    const textBlob = new Blob([clipboardText], { type: 'text/plain' });
                    const clipboardItem = new ClipboardItem({
                        'text/html': htmlBlob,
                        'text/plain': textBlob
                    });
                    
                    navigator.clipboard.write([clipboardItem]).then(finishExport).catch(err => {
                        navigator.clipboard.writeText(clipboardText).then(finishExport);
                    });
                } catch (e) {
                    navigator.clipboard.writeText(clipboardText).then(finishExport);
                }
            } else {
                navigator.clipboard.writeText(clipboardText).then(finishExport);
            }
        });
    }
    
    // Save Google Sheets URL
    const sheetsUrlInput = document.getElementById('sheetsUrlInput');
    const saveSheetsUrlBtn = document.getElementById('saveSheetsUrlBtn');
    
    sheetsUrlInput.addEventListener('input', () => {
        saveSheetsUrlBtn.style.display = 'block';
    });
    
    saveSheetsUrlBtn.addEventListener('click', async () => {
        const subjectId = els.exportSubjectSelect.value;
        if (!subjectId) {
            showToast('الرجاء اختيار المادة أولاً', 'error');
            return;
        }
        
        const url = sheetsUrlInput.value.trim();
        const subjectIndex = state.subjects.findIndex(s => s.id === subjectId);
        
        if (subjectIndex !== -1) {
            state.subjects[subjectIndex].sheetsUrl = url;
            showLoader();
            try {
                await window.dbService.saveSubjects(state.subjects);
                saveSheetsUrlBtn.style.display = 'none';
                showToast('تم حفظ الرابط في السحابة بنجاح', 'success');
            } catch (error) {
                console.error(error);
                showToast('حدث خطأ أثناء الحفظ', 'error');
            } finally {
                hideLoader();
            }
        }
    });

    els.exportSubjectSelect.addEventListener('change', async (e) => {
        const subjectId = e.target.value;
        
        // Sync with global subject
        els.globalSubjectSelect.value = subjectId;
        state.currentSubject = subjectId;
        
        if (subjectId) {
            const subject = state.subjects.find(s => s.id === subjectId);
            sheetsUrlInput.value = subject ? (subject.sheetsUrl || '') : '';
            
            showLoader();
            await loadData();
            hideLoader();
        } else {
            sheetsUrlInput.value = '';
            state.students = [];
            state.attendance = {};
            state.grades = {};
            state.materials = [];
            renderAll();
        }
        saveSheetsUrlBtn.style.display = 'none';
    });
    
    // Attendance
    els.attendanceDate.addEventListener('change', (e) => {
        state.currentDate = e.target.value;
        renderAttendance();
    });
    
    els.saveAttendanceBtn.addEventListener('click', async () => {
        if (!state.currentSubject) {
            showToast('يرجى تحديد المادة أولاً من أعلى الشاشة', 'error');
            return;
        }

        showLoader();
        const date = state.currentDate;
        const records = {};
        
        state.students.forEach(student => {
            const selected = document.querySelector(`input[name="attendance-${student.id}"]:checked`);
            if (selected) {
                records[student.id] = selected.value; 
            }
        });
        
        await window.dbService.saveAttendance(state.currentSubject, date, records);
        state.attendance[date] = records;
        
        hideLoader();
        showToast('تم حفظ الحضور بنجاح', 'success');
        renderDashboard(); 
    });
    
    // Search
    els.searchInput.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        const activeSection = document.querySelector('.view.active-view').id;
        let tbody = null;
        
        if(activeSection === 'dashboard') tbody = els.dangerTableBody;
        if(activeSection === 'attendance') tbody = els.attendanceTableBody;
        if(activeSection === 'students') tbody = els.studentsTableBody;
        
        if (tbody) {
            const rows = tbody.querySelectorAll('tr');
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                if (text.includes(val)) row.style.display = '';
                else row.style.display = 'none';
            });
        }
    });

    // Materials Event Listeners
    const handleLinkAdd = async (type) => {
        let nameInput, urlInput;
        if (type === 'curriculum') {
            nameInput = els.currNameInput;
            urlInput = els.currUrlInput;
        } else {
            nameInput = els.examNameInput;
            urlInput = els.examUrlInput;
        }

        const name = nameInput.value.trim();
        const url = urlInput.value.trim();

        if (!name || !url) {
            showToast('الرجاء كتابة الاسم ووضع الرابط أولاً.', 'error');
            return;
        }

        if (!window.dbService.useFirebase) {
            showToast('لا يمكن حفظ الروابط في الوضع المحلي. يرجى تفعيل Firebase.', 'error');
            return;
        }
        if (!state.currentSubject) {
            showToast('الرجاء اختيار المادة أولاً.', 'error');
            return;
        }

        showLoader();
        try {
            const materialObj = {
                id: `MAT-${Date.now()}`,
                name: name,
                type: type,
                url: url,
                subjectId: state.currentSubject,
                date: new Date().toISOString()
            };
            await window.dbService.saveMaterialMetadata(materialObj);
            state.materials.push(materialObj);
            
            showToast('تمت إضافة الرابط بنجاح!', 'success');
            nameInput.value = '';
            urlInput.value = '';
            renderMaterials();
        } catch (error) {
            console.error(error);
            showToast('حدث خطأ في الحفظ! تأكد من الاتصال بالإنترنت.', 'error');
        } finally {
            hideLoader();
        }
    };

    els.addCurrBtn.addEventListener('click', () => handleLinkAdd('curriculum'));
    els.addExamBtn.addEventListener('click', () => handleLinkAdd('exam'));
}

// Logic & Calculations
function calculateAbsence(studentId) {
    let absenceCount = 0;
    let excusedCount = 0;
    let presentCount = 0;
    const dates = Object.keys(state.attendance);
    let actualLecturesHeld = 0;
    
    dates.forEach(date => {
        if(Object.keys(state.attendance[date]).length > 0) {
            actualLecturesHeld++;
            const status = state.attendance[date][studentId];
            if(status === 'absent' || status === false) {
                absenceCount++;
            } else if(status === 'excused') {
                excusedCount++;
            } else if(status === 'present' || status === true) {
                presentCount++;
            }
        }
    });
    
    return {
        count: absenceCount,
        excused: excusedCount,
        present: presentCount,
        held: actualLecturesHeld
    };
}

// Render Functions
function renderAll() {
    renderSubjects();
    renderDashboard();
    renderAttendance();
    renderStudents();
    renderGrades();
    renderWarnings();
    renderMaterials();
    renderQuizzes();
}

function renderQuizzes() {
    if (!els.quizzesTableHeader || !els.quizzesTableBody) return;
    
    let headerHtml = `
        <th style="width: 50px;">ت</th>
        <th>اسم الطالب</th>
    `;
    for (let i = 1; i <= state.numQuizzes; i++) {
        headerHtml += `<th>الاختبار ${i}</th>`;
    }
    headerHtml += `
        <th style="background-color: #dcfce7;">المجموع</th>
        <th style="background-color: #dbeafe;">المعدل</th>
    `;
    els.quizzesTableHeader.innerHTML = headerHtml;
    
    els.quizzesTableBody.innerHTML = '';
    
    if (state.students.length === 0) {
        els.quizzesTableBody.innerHTML = `<tr><td colspan="${state.numQuizzes + 4}" style="text-align: center;">لا يوجد طلاب في هذه المادة</td></tr>`;
        return;
    }
    
    state.students.forEach((stu, index) => {
        const tr = document.createElement('tr');
        let html = `
            <td>${index + 1}</td>
            <td style="font-weight: 600;">${stu.name}</td>
        `;
        
        const grades = state.grades[stu.id] || {};
        const shortQuizzes = grades.shortQuizzes || [];
        let sum = 0;
        
        for (let i = 1; i <= state.numQuizzes; i++) {
            const val = shortQuizzes[i-1] !== undefined ? shortQuizzes[i-1] : '';
            if (val !== '') sum += parseFloat(val) || 0;
            html += `
                <td>
                    <input type="number" class="modern-input quiz-input" 
                        data-stu="${stu.id}" data-quiz="${i}" 
                        value="${val}" step="0.5" min="0" 
                        style="width: 60px; padding: 4px; text-align: center;">
                </td>
            `;
        }
        
        const avg = sum / state.numQuizzes;
        html += `
            <td style="font-weight: bold; color: #166534; background-color: #dcfce7;" id="quiz-sum-${stu.id}">${sum}</td>
            <td style="font-weight: bold; color: #1e40af; background-color: #dbeafe;" id="quiz-avg-${stu.id}">${Math.round(avg)}</td>
        `;
        
        tr.innerHTML = html;
        els.quizzesTableBody.appendChild(tr);
    });
    
    // Add event listeners for dynamic calculation and auto-save
    document.querySelectorAll('.quiz-input').forEach(input => {
        // Immediate UI update
        input.addEventListener('input', (e) => {
            const stuId = e.target.getAttribute('data-stu');
            let tempSum = 0;
            for (let i = 1; i <= state.numQuizzes; i++) {
                const qInput = document.querySelector(`.quiz-input[data-stu="${stuId}"][data-quiz="${i}"]`);
                tempSum += parseFloat(qInput.value) || 0;
            }
            const tempAvg = tempSum / state.numQuizzes;
            document.getElementById(`quiz-sum-${stuId}`).innerText = tempSum;
            document.getElementById(`quiz-avg-${stuId}`).innerText = Math.round(tempAvg);
        });

        // Auto-save to DB on change (when input loses focus)
        input.addEventListener('change', async (e) => {
            const stuId = e.target.getAttribute('data-stu');
            let tempSum = 0;
            let shortQuizzes = [];
            for (let i = 1; i <= state.numQuizzes; i++) {
                const qInput = document.querySelector(`.quiz-input[data-stu="${stuId}"][data-quiz="${i}"]`);
                const val = parseFloat(qInput.value) || 0;
                shortQuizzes.push(val);
                tempSum += val;
            }
            const tempAvg = tempSum / state.numQuizzes;
            
            if (!state.grades[stuId]) state.grades[stuId] = {};
            state.grades[stuId].shortQuizzes = shortQuizzes;
            
            // This will automatically calculate formative/final totals and save to database
            if (window.updateGrade) {
                window.updateGrade(stuId, 'quizzes', Math.round(tempAvg));
            } else {
                state.grades[stuId].quizzes = Math.round(tempAvg);
                if (state.currentSubject) {
                    await window.dbService.saveGrades(state.currentSubject, state.grades);
                }
            }
        });
    });
}

function renderSubjects() {
    let optionsHtml = '<option value="">-- اختر المادة --</option>';
    let listHtml = '';
    
    if (state.subjects.length === 0) {
        listHtml = '<div style="padding: 1rem; text-align: center; color: var(--text-muted); border: 1px dashed var(--border-color); border-radius: 8px;">لم تقم بإضافة أي مواد دراسية بعد.</div>';
    }
    
    state.subjects.forEach(subject => {
        const selected = subject.id === state.currentSubject ? 'selected' : '';
        const displayName = subject.stage ? `${subject.stage} - ${subject.name}` : subject.name;
        
        optionsHtml += `<option value="${subject.id}" ${selected}>${displayName}</option>`;
        
        listHtml += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.8rem; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 0.5rem; background: var(--secondary);">
                <div>
                    <strong style="color: var(--primary);">${subject.name}</strong>
                    ${subject.stage ? `<br><small class="text-muted">${subject.stage}</small>` : ''}
                </div>
                <button class="btn btn-outline" style="padding: 0.2rem 0.5rem; font-size: 0.8rem; color: var(--danger); border-color: var(--danger);" onclick="deleteSubject('${subject.id}')">حذف</button>
            </div>
        `;
    });
    
    els.globalSubjectSelect.innerHTML = optionsHtml;
    els.exportSubjectSelect.innerHTML = optionsHtml;
    els.subjectsListContainer.innerHTML = listHtml;
    
    // Auto-populate sheets URL based on the current selection in export dropdown
    const exportSubId = els.exportSubjectSelect.value;
    const sheetsUrlInput = document.getElementById('sheetsUrlInput');
    const saveSheetsUrlBtn = document.getElementById('saveSheetsUrlBtn');
    if (exportSubId && sheetsUrlInput) {
        const subject = state.subjects.find(s => s.id === exportSubId);
        sheetsUrlInput.value = subject ? (subject.sheetsUrl || '') : '';
        if(saveSheetsUrlBtn) saveSheetsUrlBtn.style.display = 'none';
    }
}

window.deleteSubject = async (id) => {
    if(confirm('هل أنت متأكد من حذف هذه المادة؟ (لن يتم حذف بيانات الحضور من السيرفر ولكن لن تظهر هنا)')) {
        state.subjects = state.subjects.filter(s => s.id !== id);
        await window.dbService.saveSubjects(state.subjects);
        if(state.currentSubject === id) {
            state.currentSubject = state.subjects.length > 0 ? state.subjects[0].id : '';
            await loadData();
        }
        renderAll();
    }
};

function renderDashboard() {
    els.totalStudents.textContent = state.students.length;
    els.totalLecturesCount.textContent = Object.keys(state.attendance).length;
    
    const todayRecords = state.attendance[state.currentDate] || {};
    const presentCount = Object.values(todayRecords).filter(v => v === 'present' || v === true).length;
    const rate = state.students.length > 0 ? (presentCount / state.students.length) * 100 : 0;
    els.attendanceRate.textContent = rate.toFixed(1) + '%';
    
    let dangerListHTML = '';
    let dangerCount = 0;
    
    if (!state.currentSubject) {
        els.dangerTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">يرجى إضافة واختيار مادة أولاً</td></tr>';
        return;
    }
    
    state.students.forEach((student, index) => {
        const abs = calculateAbsence(student.id);
        if (abs.count >= 2) {
            dangerCount++;
            dangerListHTML += `
                <tr>
                    <td><strong>${student.name}</strong></td>
                    <td class="text-danger font-bold">${abs.count} غياب (إنذار)</td>
                    <td><button class="btn btn-outline" style="font-size: 0.8rem; padding: 0.3rem 0.6rem;" onclick="alert('تنبيه للطالب المكتوب: ${student.name}')">تنبيه الطالب</button></td>
                </tr>
            `;
        }
    });
    
    els.dangerStudents.textContent = dangerCount;
    els.alertBadge.textContent = dangerCount;
    
    if (dangerCount === 0) {
        els.dangerTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">لا يوجد طلاب تجاوزوا النسبة في هذه المادة</td></tr>';
    } else {
        els.dangerTableBody.innerHTML = dangerListHTML;
    }
}

function renderAttendance() {
    const todayRecords = state.attendance[state.currentDate] || {};
    let html = '';
    
    if (!state.currentSubject) {
        html = '<tr><td colspan="4" style="text-align: center;">يرجى إضافة واختيار مادة أولاً</td></tr>';
    } else if (state.students.length === 0) {
        html = '<tr><td colspan="4" style="text-align: center;">لا يوجد طلبة مسجلين. قم بالاستيراد أولاً.</td></tr>';
    } else {
        state.students.forEach((student, index) => {
            const status = todayRecords[student.id];
            const isPresent = status === 'present' || status === true;
            const isAbsent = status === 'absent' || status === false;
            const isExcused = status === 'excused';

            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td><strong>${student.name}</strong></td>
                    <td>
                        <div class="status-group">
                            <label class="status-label present">
                                <input type="radio" name="attendance-${student.id}" value="present" ${isPresent ? 'checked' : ''}>
                                حاضر
                            </label>
                            <label class="status-label absent">
                                <input type="radio" name="attendance-${student.id}" value="absent" ${isAbsent ? 'checked' : ''}>
                                غائب
                            </label>
                            <label class="status-label excused">
                                <input type="radio" name="attendance-${student.id}" value="excused" ${isExcused ? 'checked' : ''}>
                                مجاز
                            </label>
                        </div>
                    </td>
                </tr>
            `;
        });
    }
    
    els.attendanceTableBody.innerHTML = html;
}

function renderStudents() {
    let html = '';
    
    if (!state.currentSubject) {
        html = '<tr><td colspan="4" style="text-align: center;">يرجى إضافة واختيار مادة أولاً</td></tr>';
    } else if (state.students.length === 0) {
        html = '<tr><td colspan="4" style="text-align: center;">لا يوجد طلبة مسجلين.</td></tr>';
    } else {
        state.students.forEach((student, index) => {
            const abs = calculateAbsence(student.id);
            const dangerTag = abs.count >= 2 ? ' <span style="color:var(--danger); font-weight:bold;">(إنذار)</span>' : '';
            
            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td><strong>${student.name}</strong></td>
                    <td class="text-success font-bold">${abs.present} <span class="text-muted" style="font-size: 0.8rem;">من أصل ${abs.held}</span></td>
                    <td><span style="color:var(--danger)">${abs.count} أيام</span> <span class="text-muted" style="font-size: 0.8rem;">(+${abs.excused} بعذر)</span>${dangerTag}</td>
                </tr>
            `;
        });
    }
    
    els.studentsTableBody.innerHTML = html;
}

function renderWarnings() {
    if (!els.warningsTableBody) return;
    
    let html = '';
    let hasWarnings = false;
    
    if (!state.currentSubject) {
        html = '<tr><td colspan="5" style="text-align: center;">الرجاء اختيار المادة لعرض التقرير</td></tr>';
    } else if (state.students.length === 0) {
        html = '<tr><td colspan="5" style="text-align: center;">لا يوجد طلاب مسجلين.</td></tr>';
    } else {
        state.students.forEach((student, index) => {
            const abs = calculateAbsence(student.id);
            if (abs.count >= 2) {
                hasWarnings = true;
                html += `
                    <tr>
                        <td>${index + 1}</td>
                        <td><strong>${student.name}</strong></td>
                        <td style="color: var(--danger); font-weight: bold;">${abs.count}</td>
                        <td style="color: var(--warning);">${abs.excused}</td>
                        <td style="background-color: #fecaca; color: #dc2626; font-weight: bold;">إنذار</td>
                    </tr>
                `;
            }
        });
        
        if (!hasWarnings) {
            html = '<tr><td colspan="5" style="text-align: center; color: var(--success); font-weight: bold;"><i class="bx bxs-check-circle"></i> لا يوجد أي طلاب لديهم نسبة غياب في مرحلة الخطر</td></tr>';
        }
    }
    
    els.warningsTableBody.innerHTML = html;
}

let materialsFilter = 'all';
let materialsSearchQuery = '';
let selectedMaterialFile = null;

function setupMaterialsEvents() {
    const tabFileBtn = document.getElementById('tabUploadFileBtn');
    const tabLinkBtn = document.getElementById('tabUploadLinkBtn');
    const fileContainer = document.getElementById('fileUploadContainer');
    const linkContainer = document.getElementById('linkUploadContainer');

    if (tabFileBtn && tabLinkBtn) {
        tabFileBtn.addEventListener('click', () => {
            tabFileBtn.classList.add('active');
            tabLinkBtn.classList.remove('active');
            fileContainer.style.display = 'block';
            linkContainer.style.display = 'none';
        });
        tabLinkBtn.addEventListener('click', () => {
            tabLinkBtn.classList.add('active');
            tabFileBtn.classList.remove('active');
            linkContainer.style.display = 'block';
            fileContainer.style.display = 'none';
        });
    }

    const dropzone = document.getElementById('fileDropzone');
    const fileInput = document.getElementById('materialFileInput');
    const selectedInfo = document.getElementById('selectedFileInfo');

    if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => fileInput.click());
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;
                handleFileSelected(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleFileSelected(e.target.files[0]);
            }
        });
    }

    function handleFileSelected(file) {
        selectedMaterialFile = file;
        if (selectedInfo) {
            const sizeFormatted = formatFileSize(file.size);
            selectedInfo.innerHTML = `<i class='bx bx-file'></i> تم اختيار: <strong>${file.name}</strong> (${sizeFormatted})`;
            selectedInfo.classList.remove('hidden');
        }
        const titleInput = document.getElementById('fileTitleInput');
        if (titleInput && !titleInput.value.trim()) {
            const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
            titleInput.value = nameWithoutExt;
        }
    }

    const startUploadBtn = document.getElementById('startUploadBtn');
    if (startUploadBtn) {
        startUploadBtn.addEventListener('click', async () => {
            if (!state.currentSubject) {
                showToast('يرجى اختيار مادة أولاً من قائمة المواد الأعلى', 'error');
                return;
            }
            if (!selectedMaterialFile) {
                showToast('يرجى اختيار ملف لرفعه أولاً', 'error');
                return;
            }

            const titleInput = document.getElementById('fileTitleInput');
            const categorySelect = document.getElementById('fileCategorySelect');
            const title = (titleInput ? titleInput.value.trim() : '') || selectedMaterialFile.name;
            const category = categorySelect ? categorySelect.value : 'curriculum';

            showLoader();
            try {
                const matId = `MAT-${Date.now()}`;
                const uploadRes = await window.dbService.uploadMaterialFile(matId, selectedMaterialFile);

                const newMat = {
                    id: matId,
                    name: title,
                    fileName: selectedMaterialFile.name,
                    category: category,
                    type: category,
                    size: selectedMaterialFile.size,
                    mimeType: selectedMaterialFile.type,
                    url: uploadRes.url,
                    storagePath: uploadRes.storagePath,
                    isLocal: uploadRes.isLocal,
                    subjectId: state.currentSubject,
                    date: new Date().toISOString()
                };

                await window.dbService.saveMaterialMetadata(newMat);
                state.materials.unshift(newMat);

                // Reset form
                selectedMaterialFile = null;
                if (fileInput) fileInput.value = '';
                if (titleInput) titleInput.value = '';
                if (selectedInfo) {
                    selectedInfo.innerHTML = '';
                    selectedInfo.classList.add('hidden');
                }

                renderMaterials();
                showToast('تم رفع وحفظ الملف بنجاح', 'success');
            } catch (err) {
                console.error("Upload error:", err);
                showToast('حدث خطأ أثناء رفع الملف', 'error');
            } finally {
                hideLoader();
            }
        });
    }

    // Link Upload Button
    const addCurrBtn = document.getElementById('addCurrBtn');
    if (addCurrBtn) {
        addCurrBtn.addEventListener('click', async () => {
            if (!state.currentSubject) {
                showToast('الرجاء اختيار مادة أولاً', 'error');
                return;
            }
            const nameInput = document.getElementById('currNameInput');
            const urlInput = document.getElementById('currUrlInput');
            const catSelect = document.getElementById('linkCategorySelect');

            const name = nameInput ? nameInput.value.trim() : '';
            const url = urlInput ? urlInput.value.trim() : '';
            const category = catSelect ? catSelect.value : 'curriculum';

            if (!name || !url) {
                showToast('الرجاء كتابة اسم ورابط المنهج', 'error');
                return;
            }

            showLoader();
            try {
                const matId = `MAT-LINK-${Date.now()}`;
                const newMat = {
                    id: matId,
                    name: name,
                    fileName: name,
                    category: category,
                    type: category,
                    url: url,
                    isLink: true,
                    isLocal: false,
                    subjectId: state.currentSubject,
                    date: new Date().toISOString()
                };

                await window.dbService.saveMaterialMetadata(newMat);
                state.materials.unshift(newMat);

                if (nameInput) nameInput.value = '';
                if (urlInput) urlInput.value = '';

                renderMaterials();
                showToast('تم إضافة الرابط بنجاح', 'success');
            } catch (err) {
                console.error(err);
                showToast('خطأ أثناء إضافة الرابط', 'error');
            } finally {
                hideLoader();
            }
        });
    }

    // Folder Category Filters
    const folderTabs = document.querySelectorAll('.folder-tab');
    folderTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            folderTabs.forEach(t => t.classList.remove('active'));
            const targetTab = e.currentTarget;
            targetTab.classList.add('active');
            materialsFilter = targetTab.getAttribute('data-filter') || 'all';
            renderMaterials();
        });
    });

    // Search Input
    const searchInput = document.getElementById('materialsSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            materialsSearchQuery = e.target.value.toLowerCase().trim();
            renderMaterials();
        });
    }
}

function renderMaterials() {
    const gridEl = document.getElementById('materialsGrid');
    if (!gridEl) return;

    if (!state.currentSubject) {
        gridEl.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; padding: 2rem; color: var(--text-muted); background: white; border-radius: 12px;"><i class="bx bxs-info-circle" style="font-size: 2rem; color: var(--primary);"></i><p style="margin-top: 0.5rem;">يرجى اختيار مادة دراسية من شريط التنقل العلوي لعرض مجلد ملفاتها ومناهجها.</p></div>';
        updateMaterialCounts([]);
        return;
    }

    // Filter materials by currentSubject
    let subMaterials = state.materials.filter(m => m.subjectId === state.currentSubject);

    // Update Counts for tabs
    updateMaterialCounts(subMaterials);

    // Filter by Category
    if (materialsFilter !== 'all') {
        subMaterials = subMaterials.filter(m => m.category === materialsFilter || m.type === materialsFilter);
    }

    // Filter by Search Query
    if (materialsSearchQuery) {
        subMaterials = subMaterials.filter(m => 
            (m.name && m.name.toLowerCase().includes(materialsSearchQuery)) ||
            (m.fileName && m.fileName.toLowerCase().includes(materialsSearchQuery))
        );
    }

    if (subMaterials.length === 0) {
        gridEl.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; padding: 3rem 1rem; color: var(--text-muted); background: white; border-radius: 12px; border: 1px dashed var(--border-color);"><i class="bx bx-folder-open" style="font-size: 3rem; color: var(--border-color);"></i><p style="margin-top: 0.5rem; font-weight: 600;">لا توجد ملفات أو كتب في هذا التصنيف حالياً.</p><p style="font-size: 0.85rem;">يمكنك رفع ملف جديد من النموذج بالأعلى.</p></div>';
        return;
    }

    let html = '';
    subMaterials.forEach(mat => {
        html += buildFileCard(mat);
    });
    gridEl.innerHTML = html;
}

function updateMaterialCounts(materialsList) {
    const countAll = document.getElementById('countAll');
    const countCurr = document.getElementById('countCurr');
    const countExam = document.getElementById('countExam');
    const countSumm = document.getElementById('countSumm');
    const totalBadge = document.getElementById('totalMaterialsCount');

    const total = materialsList.length;
    const currCount = materialsList.filter(m => m.category === 'curriculum' || m.type === 'curriculum').length;
    const examCount = materialsList.filter(m => m.category === 'exam' || m.type === 'exam').length;
    const summCount = materialsList.filter(m => m.category === 'summary' || m.type === 'summary').length;

    if (countAll) countAll.textContent = total;
    if (countCurr) countCurr.textContent = currCount;
    if (countExam) countExam.textContent = examCount;
    if (countSumm) countSumm.textContent = summCount;
    if (totalBadge) totalBadge.textContent = `${total} ملفات`;
}

function buildFileCard(mat) {
    const dateStr = mat.date ? new Date(mat.date).toLocaleDateString('ar-EG') : 'بدون تاريخ';
    const sizeStr = mat.size ? formatFileSize(mat.size) : (mat.isLink ? 'رابط خارجي' : 'ملف مخزن');
    const ext = getFileExtension(mat);
    const iconInfo = getFileIconInfo(ext, mat.isLink);
    const categoryInfo = getCategoryInfo(mat.category || mat.type);

    const encodedObj = encodeURIComponent(JSON.stringify(mat));

    return `
        <div class="file-card">
            <div class="file-card-top">
                <div class="file-icon-box ${iconInfo.styleClass}">
                    <i class='${iconInfo.iconClass}'></i>
                </div>
                <div class="file-details">
                    <div class="file-title" title="${mat.name}">${mat.name}</div>
                    <span class="file-category-tag ${categoryInfo.styleClass}">${categoryInfo.label}</span>
                    <div class="file-meta-row">
                        <span><i class='bx bx-calendar'></i> ${dateStr}</span>
                        <span><i class='bx bx-hdd'></i> ${sizeStr}</span>
                    </div>
                </div>
            </div>
            <div class="file-card-actions">
                <button class="btn btn-outline" onclick="openMaterialFile('${encodedObj}')">
                    <i class='bx bx-show'></i> فتح / معاينة
                </button>
                <button class="btn btn-outline" onclick="downloadMaterialFile('${encodedObj}')">
                    <i class='bx bx-download'></i> تحميل
                </button>
                <button class="btn btn-danger" style="flex: 0 0 auto; padding: 0.4rem 0.7rem;" onclick="deleteMaterialFile('${encodedObj}')" title="حذف الملف">
                    <i class='bx bx-trash'></i>
                </button>
            </div>
        </div>
    `;
}

function getFileExtension(mat) {
    if (mat.extension) return mat.extension.toLowerCase();
    if (mat.fileName) return mat.fileName.split('.').pop().toLowerCase();
    if (mat.name && mat.name.includes('.')) return mat.name.split('.').pop().toLowerCase();
    return '';
}

function getFileIconInfo(ext, isLink) {
    if (isLink) return { iconClass: 'bx bx-link-external', styleClass: 'link' };
    switch (ext) {
        case 'pdf':
            return { iconClass: 'bx bxs-file-pdf', styleClass: 'pdf' };
        case 'doc':
        case 'docx':
            return { iconClass: 'bx bxs-file-doc', styleClass: 'word' };
        case 'ppt':
        case 'pptx':
            return { iconClass: 'bx bxs-slideshow', styleClass: 'ppt' };
        case 'xls':
        case 'xlsx':
        case 'csv':
            return { iconClass: 'bx bxs-spreadsheet', styleClass: 'excel' };
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'webp':
            return { iconClass: 'bx bxs-file-image', styleClass: 'image' };
        case 'zip':
        case 'rar':
        case '7z':
            return { iconClass: 'bx bxs-file-archive', styleClass: 'zip' };
        default:
            return { iconClass: 'bx bxs-file', styleClass: 'other' };
    }
}

function getCategoryInfo(cat) {
    switch (cat) {
        case 'exam':
            return { label: '📝 نموذج اختبار', styleClass: 'exam' };
        case 'summary':
            return { label: '📄 ملخص دراسي', styleClass: 'summary' };
        case 'curriculum':
        default:
            return { label: '📚 كتاب منهج', styleClass: 'curriculum' };
    }
}

function formatFileSize(bytes) {
    if (!bytes || isNaN(bytes)) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

window.openMaterialFile = async (encodedObj) => {
    try {
        const mat = JSON.parse(decodeURIComponent(encodedObj));
        if (mat.url) {
            window.open(mat.url, '_blank');
            return;
        }
        if (mat.isLocal) {
            showLoader();
            const blob = await window.dbService.getMaterialFileFromIndexedDB(mat.id);
            hideLoader();
            if (blob) {
                const objectUrl = URL.createObjectURL(blob);
                window.open(objectUrl, '_blank');
            } else {
                showToast('تعذر العثور على الملف المحلي', 'error');
            }
        }
    } catch (e) {
        console.error(e);
        showToast('خطأ في فتح الملف', 'error');
    }
};

window.downloadMaterialFile = async (encodedObj) => {
    try {
        const mat = JSON.parse(decodeURIComponent(encodedObj));
        let downloadUrl = mat.url;
        let isTempUrl = false;

        if (!downloadUrl && mat.isLocal) {
            showLoader();
            const blob = await window.dbService.getMaterialFileFromIndexedDB(mat.id);
            hideLoader();
            if (blob) {
                downloadUrl = URL.createObjectURL(blob);
                isTempUrl = true;
            } else {
                showToast('تعذر العثور على محتوى الملف للتنزيل', 'error');
                return;
            }
        }

        if (downloadUrl) {
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = mat.fileName || mat.name || 'document';
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            if (isTempUrl) {
                setTimeout(() => URL.revokeObjectURL(downloadUrl), 10000);
            }
            showToast('جاري بدء التحميل...', 'success');
        }
    } catch (e) {
        console.error(e);
        showToast('خطأ في تحميل الملف', 'error');
    }
};

window.deleteMaterialFile = async (encodedObj) => {
    if (confirm('هل أنت متأكد من حذف هذا الملف نهائياً؟')) {
        showLoader();
        try {
            const mat = JSON.parse(decodeURIComponent(encodedObj));
            await window.dbService.deleteMaterial(mat);
            state.materials = state.materials.filter(m => m.id !== mat.id);
            renderMaterials();
            showToast('تم حذف الملف بنجاح', 'success');
        } catch (error) {
            console.error(error);
            showToast('خطأ أثناء الحذف.', 'error');
        } finally {
            hideLoader();
        }
    }
};

function renderGrades() {
    if (!els.gradesTableBody) return;
    
    if (state.students.length === 0 || !state.currentSubject) {
        els.gradesTableBody.innerHTML = '<tr><td colspan="14" style="text-align: center;">يرجى إضافة طلاب أولاً</td></tr>';
        return;
    }
    
    let html = '';
    state.students.forEach((student, index) => {
        const g = state.grades[student.id] || {};
        
        let qz = g.quizzes !== undefined ? g.quizzes : '';
        if (qz !== '') qz = Math.round(parseFloat(qz)); // Force round for display

        const asn = g.assignment !== undefined ? g.assignment : '';
        const lab = g.lab !== undefined ? g.lab : '';
        const prac = g.practical !== undefined ? g.practical : '';
        const rep = g.report !== undefined ? g.report : '';
        const sem = g.seminar !== undefined ? g.seminar : '';
        const form = g.formative !== undefined ? g.formative : 0;
        
        const mid = g.midExam !== undefined ? g.midExam : '';
        const fTheo = g.finalTheoretical !== undefined ? g.finalTheoretical : '';
        const fPrac = g.finalPractical !== undefined ? g.finalPractical : '';
        const final = g.final !== undefined ? g.final : 0;
        const status = g.status || (final >= 50 ? 'ناجح' : 'راسب');
        const statusColor = final >= 50 ? 'green' : 'red';
        const notes = g.notes || '';
        
        html += `
        <tr id="grade-row-${student.id}">
            <td style="text-align: center; border: 1px solid #000;">${index + 1}</td>
            <td style="white-space: nowrap; border: 1px solid #000;"><strong>${student.name}</strong></td>
            
            <td style="text-align: center; border: 1px solid #000;"><input type="number" class="grade-input" value="${qz}" onchange="updateGrade('${student.id}', 'quizzes', this.value)" min="0" max="10"></td>
            <td style="text-align: center; border: 1px solid #000;"><input type="number" class="grade-input" value="${asn}" onchange="updateGrade('${student.id}', 'assignment', this.value)" min="0" max="10"></td>
            <td style="text-align: center; border: 1px solid #000;"><input type="number" class="grade-input" value="${lab}" onchange="updateGrade('${student.id}', 'lab', this.value)" min="0" max="10"></td>
            <td style="text-align: center; border: 1px solid #000;"><input type="number" class="grade-input" value="${prac}" onchange="updateGrade('${student.id}', 'practical', this.value)" min="0" max="10"></td>
            <td style="text-align: center; border: 1px solid #000;"><input type="number" class="grade-input" value="${rep}" onchange="updateGrade('${student.id}', 'report', this.value)" min="0" max="10"></td>
            <td style="text-align: center; border: 1px solid #000;"><input type="number" class="grade-input" value="${sem}" onchange="updateGrade('${student.id}', 'seminar', this.value)" min="0" max="10"></td>
            <td style="text-align: center; background-color: #dcfce7; font-weight: bold; border: 1px solid #000;" class="formative-total">${form}</td>
            
            <td style="text-align: center; border: 1px solid #000;"><input type="number" class="grade-input" value="${mid}" onchange="updateGrade('${student.id}', 'midExam', this.value)" min="0" max="10"></td>
            <td style="text-align: center; border: 1px solid #000;"><input type="number" class="grade-input" value="${fTheo}" onchange="updateGrade('${student.id}', 'finalTheoretical', this.value)" min="0" max="30"></td>
            <td style="text-align: center; border: 1px solid #000;"><input type="number" class="grade-input" value="${fPrac}" onchange="updateGrade('${student.id}', 'finalPractical', this.value)" min="0" max="20"></td>
            
            <td style="text-align: center; background-color: #dbeafe; font-weight: bold; font-size: 1.1rem; border: 1px solid #000;" class="final-total">${final}</td>
            <td style="text-align: center; border: 1px solid #000;">
                <input type="text" style="width: 80px; padding: 2px; text-align: center; border: 1px solid #ccc;" value="${notes}" onchange="updateGradeNote('${student.id}', this.value)" placeholder="ملاحظة...">
                <div class="status-note" style="color: ${statusColor}; font-weight: bold; margin-top: 5px;">${status}</div>
            </td>
        </tr>
        `;
    });
    
    els.gradesTableBody.innerHTML = html;
}

window.updateGrade = function(studentId, field, value) {
    if (!state.grades[studentId]) state.grades[studentId] = {};
    const val = value === '' ? '' : (parseFloat(value) || 0);
    state.grades[studentId][field] = val;
    
    // Auto calculate totals
    const g = state.grades[studentId];
    const formative = (parseFloat(g.quizzes) || 0) + (parseFloat(g.assignment) || 0) + (parseFloat(g.lab) || 0) + (parseFloat(g.practical) || 0) + (parseFloat(g.report) || 0) + (parseFloat(g.seminar) || 0);
    g.formative = formative;
    
    const final = formative + (parseFloat(g.midExam) || 0) + (parseFloat(g.finalTheoretical) || 0) + (parseFloat(g.finalPractical) || 0);
    g.final = final;
    
    g.status = final >= 50 ? 'ناجح' : 'راسب';
    
    // Update DOM instantly
    const tr = document.getElementById(`grade-row-${studentId}`);
    if (tr) {
        tr.querySelector('.formative-total').textContent = formative;
        tr.querySelector('.final-total').textContent = final;
        const statusEl = tr.querySelector('.status-note');
        statusEl.textContent = g.status;
        statusEl.style.color = final >= 50 ? 'green' : 'red';
    }
    
    // Debounce save
    clearTimeout(window.saveGradesTimeout);
    window.saveGradesTimeout = setTimeout(async () => {
        await window.dbService.saveGrades(state.currentSubject, state.grades);
    }, 1000);
};

window.updateGradeNote = function(studentId, value) {
    if (!state.grades[studentId]) state.grades[studentId] = {};
    state.grades[studentId].notes = value;
    clearTimeout(window.saveGradesTimeout);
    window.saveGradesTimeout = setTimeout(async () => {
        await window.dbService.saveGrades(state.currentSubject, state.grades);
    }, 1000);
};

if (els.exportGradesBtn) {
    els.exportGradesBtn.addEventListener('click', () => {
        if (!state.currentSubject) {
            showToast('الرجاء اختيار المادة أولاً', 'error');
            return;
        }
        const subject = state.subjects.find(s => s.id === state.currentSubject);
        const customUrl = subject ? subject.sheetsUrl : '';
        window.ExcelService.exportGradesToGoogleSheets(state.students, state.grades, customUrl);
    });
}

// UI Helpers
function showLoader() { els.loader.classList.remove('hidden'); }
function hideLoader() { els.loader.classList.add('hidden'); }

let toastTimeout;
function showToast(message, type = 'success') {
    els.toast.textContent = message;
    els.toast.className = `toast show ${type}`;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        els.toast.classList.remove('show');
    }, 3000);
}

// Start
document.addEventListener('DOMContentLoaded', init);
