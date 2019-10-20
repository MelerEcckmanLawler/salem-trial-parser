# salem-trial-parser
```
npm i salem-trial-parser
```

```
const parseReport = require('salem-trial-parser')

let filename = 'report.html'
parseReport(filename).then((report) => {
  console.log(report.players)
  console.log(report.entries)
})
```
