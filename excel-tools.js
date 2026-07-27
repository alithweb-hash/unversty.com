// excel-tools.js

class ExcelService {
    static async importStudents(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    if (jsonData.length === 0) {
                        return resolve([]);
                    }

                    const students = [];
                    // Skip header row usually index 0
                    for(let i = 1; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        if (row && row.length > 0) {
                            // Try to find the name in the first two columns (incase they have seq number in first)
                            let name = row[0];
                            if (row.length > 1 && typeof row[1] === 'string' && row[1].trim() !== '') {
                                // If second column has string, it's likely the name and first is sequence
                                name = row[1];
                            }
                            
                            if (name) {
                                students.push({
                                    id: `STU-${Date.now()}-${i}`,
                                    name: String(name).trim()
                                });
                            }
                        }
                    }
                    resolve(students);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = (err) => reject(err);
            reader.readAsArrayBuffer(file);
        });
    }

    static exportToExcel(students, allAttendance, totalLectures) {
        let dates = Object.keys(allAttendance).sort();
        let headers = ['التسلسل', 'اسم الطالب', 'إجمالي الغياب', 'نسبة الغياب %', 'إجمالي المجاز', ...dates];
        
        let exportData = [headers];
        
        students.forEach((student, index) => {
            let absenceCount = 0;
            let excusedCount = 0;
            
            let row = [index + 1, student.name];
            
            let attendanceStatuses = [];
            dates.forEach(date => {
                const status = allAttendance[date] && allAttendance[date][student.id];
                let statusText = 'لم يسجل';
                if (status === 'present') statusText = 'حاضر';
                else if (status === 'absent') { statusText = 'غائب'; absenceCount++; }
                else if (status === 'excused') { statusText = 'مجاز'; excusedCount++; }
                else if (status === true) { statusText = 'حاضر'; } // legacy boolean compatibility
                else if (status === false) { statusText = 'غائب'; absenceCount++; }
                
                attendanceStatuses.push(statusText);
            });
            
            let percentage = totalLectures > 0 ? Math.round((absenceCount / totalLectures) * 100) : 0;
            
            row.push(absenceCount);
            row.push(percentage + '%');
            row.push(excusedCount);
            row = row.concat(attendanceStatuses);
            
            exportData.push(row);
        });
        
        const ws = XLSX.utils.aoa_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "تقرير الحضور");
        
        XLSX.writeFile(wb, `تقرير_الحضور_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

    static exportToGoogleSheets(students, allAttendance, totalLectures, customUrl = '') {
        let dates = Object.keys(allAttendance).sort();
        let headers = ['التسلسل', 'اسم الطالب', 'الحضور', 'إجمالي الغياب', 'نسبة الغياب %', 'المجاز', ...dates];
        
        let tsvLines = [headers.join('\t')];
        
        let html = '<table border="1" style="border-collapse: collapse; font-family: sans-serif;">';
        html += '<thead><tr>';
        headers.forEach(h => html += `<th style="background-color: #f3f4f6; font-weight: bold; padding: 8px;">${h}</th>`);
        html += '</tr></thead><tbody>';
        
        students.forEach((student, index) => {
            let absenceCount = 0;
            let excusedCount = 0;
            let presentCount = 0;
            let heldCount = 0;
            
            let rowTsv = [index + 1, student.name];
            let rowHtml = `<tr><td style="padding: 5px;">${index + 1}</td><td style="padding: 5px; font-weight: bold;">${student.name}</td>`;
            
            let dateCellsTsv = [];
            let dateCellsHtml = '';
            
            dates.forEach(date => {
                if(Object.keys(allAttendance[date]).length > 0) {
                     heldCount++;
                }
                const status = allAttendance[date] && allAttendance[date][student.id];
                if (status === 'absent' || status === false) {
                    dateCellsTsv.push('غائب');
                    dateCellsHtml += '<td style="color: #dc2626; padding: 5px;">غائب</td>';
                    absenceCount++;
                } else if (status === 'excused') {
                    dateCellsTsv.push('مجاز');
                    dateCellsHtml += '<td style="color: #d97706; padding: 5px;">مجاز</td>';
                    excusedCount++;
                } else if (status === 'present' || status === true) {
                    dateCellsTsv.push('حاضر');
                    dateCellsHtml += '<td style="color: #16a34a; padding: 5px;">حاضر</td>';
                    presentCount++;
                } else {
                    dateCellsTsv.push('-');
                    dateCellsHtml += '<td style="padding: 5px;">-</td>';
                }
            });
            
            const pctVal = totalLectures > 0 ? (absenceCount / totalLectures) * 100 : 0;
            const pctStr = pctVal.toFixed(1) + '%';
            
            let pctStyle = 'padding: 5px; text-align: center;';
            if (pctVal >= 20) {
                pctStyle += ' background-color: #fecaca; color: #dc2626; font-weight: bold;'; // Danger Red
            } else if (pctVal >= 10) {
                pctStyle += ' background-color: #fef08a; color: #a16207; font-weight: bold;'; // Warning Yellow
            }
            
            const presenceStr = `${presentCount} من ${heldCount}`;
            rowHtml += `<td style="padding: 5px; color: #16a34a;">${presenceStr}</td>`;
            rowHtml += `<td style="padding: 5px; color: #dc2626;">${absenceCount}</td>`;
            rowHtml += `<td style="${pctStyle}">${pctStr}</td>`;
            rowHtml += `<td style="padding: 5px;">${excusedCount}</td>`;
            rowHtml += dateCellsHtml + '</tr>';
            
            rowTsv.splice(2, 0, presenceStr, absenceCount, pctStr, excusedCount);
            rowTsv = rowTsv.concat(dateCellsTsv);
            
            tsvLines.push(rowTsv.join('\t'));
            html += rowHtml;
        });
        
        html += '</tbody></table>';
        const clipboardText = tsvLines.join('\n');
        
        const finishExport = () => {
            alert("تم نسخ البيانات والتنسيقات بنجاح!\n\nقم بالذهاب إلى جدولك واضغط (Ctrl+V) للصق البيانات.");
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
                
                navigator.clipboard.write([clipboardItem])
                    .then(finishExport)
                    .catch(err => {
                        console.warn('Rich text copy failed, falling back to plain text', err);
                        navigator.clipboard.writeText(clipboardText).then(finishExport);
                    });
            } catch (e) {
                navigator.clipboard.writeText(clipboardText).then(finishExport);
            }
        } else {
            navigator.clipboard.writeText(clipboardText).then(finishExport);
        }
    }
}

window.ExcelService = ExcelService;
