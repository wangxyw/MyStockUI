

var request = require("request");
var fs = require("fs");

// this holiday data get from http://timor.tech/api/holiday/year/2022/ when offical holiday is announced
var year = process.argv.splice(2)[0];
var options = { method: 'GET',
  url: `http://timor.tech/api/holiday/year/${year}`
};

request(options, function (error, response, body) {
  if (error) throw new Error(error);
 
  const data = JSON.parse(body).holiday;
 
  const newholidays = Object.keys(data).map(i => data[i].date);
  const tradingDays = getTradingDays(year, newholidays);
  fs.readFile('../client/component/date.json', (err, d) => {
    const existedDate = JSON.parse(d.toString());
    const existedHoliday = existedDate.holiday;
    const existedWorkday = existedDate.workday;
    const newData = {
      holiday: existedHoliday.concat(newholidays),
      workday: existedWorkday.concat(tradingDays)
    }
    console.log(newData);
    fs.writeFile('../client/component/date.json', JSON.stringify(newData), () => {
    })
  });
});





function getMonthLength(date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  d.setDate('1');
  d.setDate(d.getDate() - 1);
  return d.getDate();
}

function getTradingDays(year, holidays) {
  const arr = [];
  for (let i = 1; i <= 12; i++) {
    const days = getMonthLength(`${year}-${i}-01`);
    for (let j = 1; j <= days; j++) {
      if (
        new Date(`${year}-${i}-${j}`).getDay() !== 0 &&
        new Date(`${year}-${i}-${j}`).getDay() !== 6
      ) {
        let i1 = '';
        let j1 = '';
        if (i < 10 && i > 0) {
          i1 = `0${i}`;
        } else {
          i1 = i;
        }
        if (j < 10 && j > 0) {
          j1 = `0${j}`;
        } else {
          j1 = j;
        }
        if (!holidays.includes(`${year}-${i1}-${j1}`)) {
          arr.push(`${year}-${i1}-${j1}`);
        }  
      }
    }
  }
  return arr;
}


