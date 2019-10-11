# salem-trial-parser
```
npm i salem-trial-parser
```

```
const parseReport = require('salem-trial-parser')

let filename = 'report.html'
parseReport(filename).then((report) => {
  console.log(report.players)
  //each player is indexed twice, under their account name and in-game name
  console.log(report.entries)
})
```
