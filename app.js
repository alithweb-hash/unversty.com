// app.js

// State
let state = {
    students: [],
    subjects: [], // {id, name}
    currentSubject: '', // Selected subject ID
    attendance: {}, // Now specific to current subject: { '2023-10-01': { 'stu-id': 'present' } }
    materials: [], // { id, name, type (curriculum|exam), url, path, subjectId, date }
    totalLectures: parseInt(localStorage.getItem('totalLectures') || '15'),
    currentDate: new Date().toISOString().split('T')[0]
};

// DOM Elements
const els = {
    navLinks: document.querySelectorAll('.nav-links li'),
    views: document.querySelectorAll('.view'),
    totalLecturesInput: document.getElementById('totalLecturesInput'),
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
    
    // Import/Export
    excelFileInput: document.getElementById('excelFileInput'),
    exportExcelBtn: document.getElementById('exportExcelBtn'),
    exportSheetsBtn: document.getElementById('exportSheetsBtn'),
    
    // Search
    searchInput: document.getElementById('searchInput'),
    
    // Warnings
    warningsTableBody: document.getElementById('warningsTableBody'),
    exportWarningsBtn: document.getElementById('exportWarningsBtn'),
    
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
    
    els.totalLecturesInput.value = state.totalLectures;
    const fbConfig = localStorage.getItem('firebaseConfig');
    if (fbConfig) els.firebaseConfigInput.value = fbConfig;
    els.attendanceDate.value = state.currentDate;
    
    // Default dates for export (current month)
    const dateObj = new Date();
    els.exportDateFrom.value = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1).toISOString().split('T')[0];
    els.exportDateTo.value = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0).toISOString().split('T')[0];
    
    await loadData();
    setupEvents();
    
    hideLoader();
    renderAll();
}

async function loadData() {
    state.subjects = await window.dbService.getSubjects();
    
    if (state.subjects.length > 0 && !state.currentSubject) {
        state.currentSubject = state.subjects[0].id;
    }
    
    if (state.currentSubject) {
        state.students = await window.dbService.getStudents(state.currentSubject);
        state.attendance = await window.dbService.getAllAttendance(state.currentSubject);
        if (window.dbService.useFirebase) {
            state.materials = await window.dbService.getMaterials(state.currentSubject);
        } else {
            state.materials = [];
        }
    } else {
        state.attendance = {};
        state.materials = [];
    }
}

// Event Listeners Setup
function setupEvents() {
    els.navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const target = e.currentTarget.getAttribute('data-target');
            els.navLinks.forEach(l => l.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            els.views.forEach(v => v.classList.remove('active-view'));
            document.getElementById(target).classList.add('active-view');
            
            renderAll();
        });
    });
    
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
    els.saveSettingsBtn.addEventListener('click', () => {
        state.totalLectures = parseInt(els.totalLecturesInput.value) || 15;
        localStorage.setItem('totalLectures', state.totalLectures);
        showToast('تم حفظ الإعدادات بنجاح', 'success');
        renderAll();
    });
    
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
        if(confirm('هل أنت متأكد من مسح جميع الطلبة وبيانات الحضور؟')) {
            showLoader();
            await window.dbService.clearStudents();
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
            // Fetch attendance for selected subject
            const subAttendance = await window.dbService.getAllAttendance(subjectId);
            
            // Filter dates
            const filteredAttendance = {};
            Object.keys(subAttendance).forEach(date => {
                if (date >= dateFrom && date <= dateTo) {
                    filteredAttendance[date] = subAttendance[date];
                }
            });
            
            if (type === 'excel') {
                window.ExcelService.exportToExcel(state.students, filteredAttendance, state.totalLectures);
                showToast('تم التصدير بنجاح', 'success');
            } else {
                const customUrl = document.getElementById('sheetsUrlInput').value.trim();
                window.ExcelService.exportToGoogleSheets(state.students, filteredAttendance, state.totalLectures, customUrl);
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
                if (parseFloat(abs.percentageCurrent) >= 20) {
                    dangerStudents.push({
                        seq: index + 1,
                        name: student.name,
                        absentCount: abs.count,
                        excusedCount: abs.excused,
                        percentageCurrent: abs.percentageCurrent
                    });
                }
            });
            
            if (dangerStudents.length === 0) {
                showToast('لا يوجد طلبة تجاوزوا نسبة الإنذار للتصدير', 'error');
                return;
            }
            
            // Export to Google Sheets
            const subjectId = state.currentSubject;
            const customUrl = localStorage.getItem(`sheetsUrl_${subjectId}`) || '';
            
            let exportData = [];
            let headers = ['التسلسل', 'الاسم', 'أيام الغياب', 'الإجازات', 'النسبة % (من المُقامة)'];
            
            let tsvLines = [headers.join('\t')];
            let html = '<table border="1" style="border-collapse: collapse; font-family: sans-serif;">';
            html += '<thead><tr>';
            headers.forEach(h => html += `<th style="background-color: #fecaca; font-weight: bold; padding: 8px;">${h}</th>`);
            html += '</tr></thead><tbody>';
            
            dangerStudents.forEach(stu => {
                let rowTsv = [stu.seq, stu.name, stu.absentCount, stu.excusedCount, `${stu.percentageCurrent}%`];
                tsvLines.push(rowTsv.join('\t'));
                
                html += `<tr>`;
                html += `<td style="padding: 5px;">${stu.seq}</td>`;
                html += `<td style="padding: 5px; font-weight: bold;">${stu.name}</td>`;
                html += `<td style="padding: 5px; color: #dc2626;">${stu.absentCount}</td>`;
                html += `<td style="padding: 5px; color: #d97706;">${stu.excusedCount}</td>`;
                html += `<td style="padding: 5px; background-color: #fecaca; color: #dc2626; font-weight: bold;">${stu.percentageCurrent}%</td>`;
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
            showToast('الرجاء إدخال الاسم والرابط معاً.', 'error');
            return;
        }

        if (!window.dbService.useFirebase) {
            showToast('لا يمكن حفظ الروابط في الوضع المحلي. الرجاء ربط Firebase.', 'error');
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
            showToast('خطأ أثناء الحفظ! تأكد من اتصالك بالإنترنت.', 'error');
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
    
    const percentage = state.totalLectures > 0 ? (absenceCount / state.totalLectures) * 100 : 0;
    const percentageCurrent = actualLecturesHeld > 0 ? (absenceCount / actualLecturesHeld) * 100 : 0;
    
    return {
        count: absenceCount,
        excused: excusedCount,
        present: presentCount,
        held: actualLecturesHeld,
        percentage: percentage.toFixed(1),
        percentageCurrent: percentageCurrent.toFixed(1)
    };
}

// Render Functions
function renderAll() {
    renderSubjects();
    renderDashboard();
    renderAttendance();
    renderStudents();
    renderWarnings();
    renderMaterials();
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
    els.totalLecturesCount.textContent = state.totalLectures;
    
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
        if (parseFloat(abs.percentage) >= 20) {
            dangerCount++;
            dangerListHTML += `
                <tr>
                    <td><strong>${student.name}</strong></td>
                    <td class="text-danger font-bold">${abs.percentage}% (${abs.count} محاضرات)</td>
                    <td><button class="btn btn-outline" style="font-size: 0.8rem; padding: 0.3rem 0.6rem;" onclick="alert('إرسال إنذار للطالب: ${student.name}')">توجيه إنذار</button></td>
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
            const isDanger = parseFloat(abs.percentage) >= 20;
            const pctColor = isDanger ? 'color: var(--danger); font-weight: bold;' : '';
            
            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td><strong>${student.name}</strong></td>
                    <td class="text-success font-bold">${abs.present} <span class="text-muted" style="font-size: 0.8rem;">من أصل ${abs.held}</span></td>
                    <td><span style="color:var(--danger)">${abs.count} غياب</span> <span class="text-muted" style="font-size: 0.8rem;">(+${abs.excused} مجاز)</span></td>
                    <td style="${pctColor}">${abs.percentage}%</td>
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
        html = '<tr><td colspan="5" style="text-align: center;">يرجى إضافة واختيار مادة أولاً</td></tr>';
    } else if (state.students.length === 0) {
        html = '<tr><td colspan="5" style="text-align: center;">لا يوجد طلبة مسجلين.</td></tr>';
    } else {
        state.students.forEach((student, index) => {
            const abs = calculateAbsence(student.id);
            if (parseFloat(abs.percentageCurrent) >= 20) {
                hasWarnings = true;
                html += `
                    <tr>
                        <td>${index + 1}</td>
                        <td><strong>${student.name}</strong></td>
                        <td style="color: var(--danger); font-weight: bold;">${abs.count}</td>
                        <td style="color: var(--warning);">${abs.excused}</td>
                        <td style="background-color: #fecaca; color: #dc2626; font-weight: bold;">${abs.percentageCurrent}%</td>
                    </tr>
                `;
            }
        });
        
        if (!hasWarnings) {
            html = '<tr><td colspan="5" style="text-align: center; color: var(--success); font-weight: bold;"><i class="bx bxs-check-circle"></i> لا يوجد أي طلبة متجاوزين للحد المسموح حالياً</td></tr>';
        }
    }
    
    els.warningsTableBody.innerHTML = html;
}

function renderMaterials() {
    if (!window.dbService.useFirebase) {
        const msg = '<div style="text-align:center; padding: 1rem; color: var(--text-muted);">عذراً، رفع وعرض الملفات يتطلب تفعيل Firebase (السحابة).</div>';
        els.curriculumList.innerHTML = msg;
        els.examsList.innerHTML = msg;
        return;
    }
    
    if (!state.currentSubject) {
        const msg = '<div style="text-align:center; padding: 1rem; color: var(--text-muted);">يرجى إضافة مادة دراسية واختيارها أولاً.</div>';
        els.curriculumList.innerHTML = msg;
        els.examsList.innerHTML = msg;
        return;
    }

    let currHtml = '';
    let examHtml = '';

    const currMats = state.materials.filter(m => m.type === 'curriculum');
    const examMats = state.materials.filter(m => m.type === 'exam');

    if (currMats.length === 0) {
        currHtml = '<div style="text-align:center; padding: 1rem; color: var(--text-muted);">لا توجد ملفات مناهج.</div>';
    } else {
        currMats.forEach(mat => {
            currHtml += buildMaterialCard(mat);
        });
    }

    if (examMats.length === 0) {
        examHtml = '<div style="text-align:center; padding: 1rem; color: var(--text-muted);">لا توجد نماذج أسئلة.</div>';
    } else {
        examMats.forEach(mat => {
            examHtml += buildMaterialCard(mat);
        });
    }

    els.curriculumList.innerHTML = currHtml;
    els.examsList.innerHTML = examHtml;
}

function buildMaterialCard(mat) {
    const dateStr = new Date(mat.date).toLocaleDateString('ar-EG');
    // Using stringified obj to pass it to onclick (simple hack for global scope)
    const encodedObj = encodeURIComponent(JSON.stringify(mat));
    return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.8rem; border: 1px solid var(--border-color); border-radius: 8px; background: var(--card-bg);">
            <div style="display: flex; flex-direction: column; gap: 0.2rem; overflow: hidden;">
                <strong style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;" title="${mat.name}">${mat.name}</strong>
                <span class="text-muted" style="font-size: 0.8rem;">${dateStr}</span>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <a href="${mat.url}" target="_blank" class="btn btn-outline" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;"><i class='bx bx-link-external'></i> فتح الرابط</a>
                <button class="btn btn-danger" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="deleteMaterialFile('${encodedObj}')"><i class='bx bx-trash'></i></button>
            </div>
        </div>
    `;
}

window.deleteMaterialFile = async (encodedObj) => {
    if(confirm('هل أنت متأكد من حذف هذا الملف نهائياً؟')) {
        showLoader();
        try {
            const mat = JSON.parse(decodeURIComponent(encodedObj));
            await window.dbService.deleteMaterial(mat);
            state.materials = state.materials.filter(m => m.id !== mat.id);
            renderMaterials();
            showToast('تم الحذف بنجاح', 'success');
        } catch(error) {
            console.error(error);
            showToast('خطأ أثناء الحذف.', 'error');
        } finally {
            hideLoader();
        }
    }
};

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
