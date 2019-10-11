# salem-trial-parser

const parseReport = require('salem-trial-parser')

let filename = `report.html`

parseReport(filename).then((report) => {
    console.log(report.players)
    //players will be logged twice
    //because
    //they are indexed under both account name and in-game name for convenience
    console.log(report.entries)
    //each entry is a game message
    //e.g. a chat message, a whisper, a notification that someone was killed or lynched, an ability was used, etc.
})
