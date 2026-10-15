const fs = require('fs');
const path = require('path');

const calendarPath = path.resolve(__dirname, '../client/component/date.json');

function validateYear(year) {
  if (!/^\d{4}$/.test(String(year))) throw new Error('A four-digit calendar year is required');
  return String(year);
}

function validateDate(day, year) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) || (year && !day.startsWith(`${year}-`))
      || !Number.isFinite(Date.parse(`${day}T00:00:00Z`)) || new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) {
    throw new Error('Invalid calendar date; calendar was not changed');
  }
}

function parseHolidayResponse(body, year) {
  year = validateYear(year);
  const payload = JSON.parse(body);
  if (!payload || payload.code !== 0 || !payload.holiday || typeof payload.holiday !== 'object' || Array.isArray(payload.holiday)) {
    throw new Error('Invalid holiday response; calendar was not changed');
  }
  const holidays = [];
  for (const [key, item] of Object.entries(payload.holiday)) {
    if (!item || typeof item.holiday !== 'boolean') throw new Error('Invalid holiday flag; calendar was not changed');
    validateDate(item.date, year);
    if (key !== item.date.slice(5)) throw new Error('Holiday key/date mismatch; calendar was not changed');
    if (item.holiday) holidays.push(item.date);
  }
  if (!holidays.length) throw new Error('Holiday data is empty; calendar was not changed');
  return holidays;
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

function replaceCalendarYear(calendar, year, holidays, reference = calendar) {
  year = validateYear(year);
  if (!Array.isArray(holidays) || holidays.length === 0) throw new Error('Holiday data is empty; calendar was not changed');
  for (const day of holidays) validateDate(day, year);
  if (!calendar || !Array.isArray(calendar.holiday) || !Array.isArray(calendar.workday)
      || !reference || !Array.isArray(reference.workday) || (reference.holiday !== undefined && !Array.isArray(reference.holiday))) {
    throw new Error('Invalid calendar/reference format; calendar was not changed');
  }
  for (const day of [...calendar.holiday, ...calendar.workday, ...reference.workday, ...(reference.holiday || [])]) validateDate(day);
  const expected = reference.workday.filter(day => day.startsWith(`${year}-`)).sort();
  if (!expected.length) throw new Error(`No reference trading dates for ${year}; use --reference with a verified full-year calendar`);
  if (new Set(expected).size !== expected.length || expected.some(day => [0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay())
      || (reference.holiday || []).includes(day))) {
    throw new Error('Reference contains duplicate, weekend or conflicting trading dates; calendar was not changed');
  }
  const tradingDays = getTradingDays(year, holidays);
  const expectedSet = new Set(expected), proposedSet = new Set(tradingDays);
  const newlyOpen = tradingDays.filter(day => !expectedSet.has(day));
  const newlyClosed = expected.filter(day => !proposedSet.has(day));
  if (newlyOpen.length || newlyClosed.length) {
    throw new Error(`Calendar differs from reference for ${year}; newly open: ${newlyOpen.join(',') || '(none)'}; newly closed: ${newlyClosed.join(',') || '(none)'}; calendar was not changed`);
  }
  const keepOtherYears = days => days.filter(day => !day.startsWith(`${year}-`));
  return {
    holiday: [...new Set([...keepOtherYears(calendar.holiday), ...holidays])].sort(),
    workday: [...new Set([...keepOtherYears(calendar.workday), ...tradingDays])].sort(),
  };
}

function parseArguments(args) {
  const year = validateYear(args[0]);
  const options = {check: false};
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--check') options.check = true;
    else if (args[i] === '--reference' && args[i + 1] && !args[i + 1].startsWith('--') && !options.referencePath) {
      options.referencePath = path.resolve(args[++i]);
    } else throw new Error('Usage: node caculate_date.js YEAR [--check] [--reference FILE]');
  }
  return {year, options};
}

function updateCalendar(year, options = {}) {
  year = validateYear(year);
  const request = require('request');
  request({ method: 'GET', url: `https://timor.tech/api/holiday/year/${year}/`, timeout: 30000 }, (error, response, body) => {
    if (error) throw error;
    if (!response || response.statusCode !== 200) throw new Error('Holiday request failed; calendar was not changed');
    const holidays = parseHolidayResponse(body, year);
    const original = fs.readFileSync(calendarPath, 'utf8');
    const calendar = JSON.parse(original);
    const reference = options.referencePath ? JSON.parse(fs.readFileSync(options.referencePath, 'utf8')) : calendar;
    const updated = replaceCalendarYear(calendar, year, holidays, reference);
    const count = updated.workday.filter(day => day.startsWith(year + '-')).length;
    if (options.check) {
      console.log(`Checked ${year}: ${count} trading days; no file written`);
      return;
    }
    if (fs.readFileSync(calendarPath, 'utf8') !== original) throw new Error('Calendar changed during validation; calendar was not overwritten');
    const temporaryPath = `${calendarPath}.${process.pid}.tmp`;
    try {
      fs.writeFileSync(temporaryPath, JSON.stringify(updated, null, 4) + '\n');
      fs.renameSync(temporaryPath, calendarPath);
    } finally {
      if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    }
    console.log(`Updated ${year}: ${count} trading days`);
  });
}

module.exports = { getTradingDays, replaceCalendarYear, parseHolidayResponse, parseArguments };
if (require.main === module) {
  const {year, options} = parseArguments(process.argv.slice(2));
  updateCalendar(year, options);
}
