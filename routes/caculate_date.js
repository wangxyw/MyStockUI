const fs = require('fs');
const path = require('path');

const calendarPath = path.resolve(__dirname, '../client/component/date.json');

function validateYear(year) {
  if (!/^\d{4}$/.test(String(year))) throw new Error('A four-digit calendar year is required');
  return String(year);
}

function getTradingDays(year, holidays) {
  year = validateYear(year);
  const closed = new Set(holidays);
  const days = [];
  for (const date = new Date(`${year}-01-01T00:00:00Z`); date.getUTCFullYear() === Number(year); date.setUTCDate(date.getUTCDate() + 1)) {
    const key = date.toISOString().slice(0, 10);
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6 && !closed.has(key)) days.push(key);
  }
  return days;
}

function replaceCalendarYear(calendar, year, holidays) {
  year = validateYear(year);
  if (!Array.isArray(holidays) || holidays.length === 0) throw new Error('Holiday data is empty; calendar was not changed');
  for (const day of holidays) {
    if (typeof day !== 'string' || !day.startsWith(`${year}-`) || !/^\d{4}-\d{2}-\d{2}$/.test(day)
        || !Number.isFinite(Date.parse(`${day}T00:00:00Z`)) || new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) {
      throw new Error('Invalid holiday date; calendar was not changed');
    }
  }
  const keepOtherYears = days => days.filter(day => !day.startsWith(`${year}-`));
  return {
    holiday: [...new Set([...keepOtherYears(calendar.holiday), ...holidays])].sort(),
    workday: [...new Set([...keepOtherYears(calendar.workday), ...getTradingDays(year, holidays)])].sort(),
  };
}

function updateCalendar(year) {
  year = validateYear(year);
  const request = require('request');
  request({ method: 'GET', url: `https://timor.tech/api/holiday/year/${year}`, timeout: 30000 }, (error, response, body) => {
    if (error) throw error;
    if (!response || response.statusCode !== 200) throw new Error('Holiday request failed; calendar was not changed');
    const payload = JSON.parse(body);
    if (payload.code !== 0 || !payload.holiday) throw new Error('Invalid holiday response; calendar was not changed');
    const holidays = Object.values(payload.holiday).filter(item => item.holiday === true).map(item => item.date);
    const calendar = JSON.parse(fs.readFileSync(calendarPath, 'utf8'));
    const updated = replaceCalendarYear(calendar, year, holidays);
    const temporaryPath = `${calendarPath}.${process.pid}.tmp`;
    try {
      fs.writeFileSync(temporaryPath, JSON.stringify(updated, null, 4) + '\n');
      fs.renameSync(temporaryPath, calendarPath);
    } finally {
      if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    }
    console.log(`Updated ${year}: ${updated.workday.filter(day => day.startsWith(year + '-')).length} trading days`);
  });
}

module.exports = { getTradingDays, replaceCalendarYear };
if (require.main === module) updateCalendar(process.argv[2]);
