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

Only maintained for Ranked reports, and I tend to publish breaking changes constantly so just be aware.

Reports identify promoted Executioners as Jesters, promoted Mafiosos as Godfathers, and promoted Random Mafia as Mafiosos.  There's no way to automatically correct this as far as I'm aware.
