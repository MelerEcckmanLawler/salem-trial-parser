const cheerio = require('cheerio')
const fs = require('fs').promises

async function reportToString(reportId) {
  let HTML = await fs.readFile(`${reportId}.html`, `utf8`)
  return HTML
}

function playerListFromHTML(HTML) {
  let index = HTML.indexOf(`[`)
  let players = HTML.slice(index)
  index = players.indexOf(`[`)
  players = players.slice(index)
  index = players.indexOf(`]`)
  players = players.slice(0, index + 1)
  players = JSON.parse(players)

  playersNew = {}
  for (let k in players) {
    let player = players[k]
    let account = player.username
    let name = player.ign
    let role = player.role
    let position = player.slot
    player = { account: account, name: name, role: role, position: position }
    playersNew[account] = player
    playersNew[name] = player
  }
  return playersNew
}

function getSpans(HTML) {
  let $ = cheerio.load(HTML)
  let spanParents = $('#reportContent').find('span')
  let spans = []
  for (let i = 0; i < spanParents.length; i++) {
    spans[i] = { data: spanParents[i].children[0].data }
    spans[i].attribs = spanParents[i].attribs
  }
  return spans
}

function spansToArrayOfEntries(spans, players) {
  // { data: 'Lobby', attribs: { class: 'stage' } }
  // { data: 'Players are choosing names', attribs: { class: 'stage' } }
  // { data: 'Ranked Game.', attribs: { title: '  ', class: 'notice' } }

  // CHAT MESSAGE
  // { data: 'Fancy Dube: Hi', attribs: { title: 'Godfather2', class: 'DonParme Godfather2' } }
  // { data: 'Day 1', attribs: { class: 'time day' } }
  // { data: 'Night 2', attribs: { class: 'time night' } }

  // JAIL CHAT
  // { data: 'Edward Bishop: Hey' ,attribs: { title: 'Godfather', class: 'OliUnglaube007 Godfather jail' } }

  //Godfather2 is an actual role!

  // MAFIA CHAT
  // { data: 'William Hobbs: im escort', attribs: { title: 'Mafioso2', class: 'aglayin123 Mafioso2 mafia' } }

  // ABILITY
  // { data: 'flame investigated Spheal.',attribs: { title: 'Investigator  ', class: 'notice Investigator  Investigator' } }

  // NIGHT KILL
  // { data: 'Court has been killed.', attribs: { title: 'Medium  ', class: 'notice Medium  death' } }
  // { data: 'Court was attacked by the Mafia.', attribs: { title: 'Medium  ', class: 'notice' } }

  // LAST WILL / DEATH NOTE
  // { data: undefined, attribs: { class: 'note','data-type': 'will', 'data-info': 'PHNwYW4gaWQ9J3dpbGxPd25lcic+U3BoZWFsKFF1YWtlTkxEKTo8L3NwYW4+U3BoZWFsJm5ic3A7LSZuYnNwO0ludmVzdGlnYXRvcjxiciAvPg08YnIgLz4NTjE6VmlnaWwmbmJzcDsoMTQpPGJyIC8+' } }

  // DEAD CHAT
  // { data: 'Spheal: Ok Medium, straight down to business: Spheal - InvestigatorN1: Vigil (14) - Lookout, Forger, Witch', attribs: { title: 'Investigator', class: 'QuakeNLD Investigator dead' } }

  // MEDIUM
  // { data: 'Court: Medium Court here', attribs: { title: 'Medium', class: 'ClainS Medium seance' } }

  // WHISPER
  // { data: 'Edward Bishop to Simp:  well u fucked up ur fault ', attribs: { title: 'Godfather Jester OliUnglaube007 Badream ', class: 'Godfather Jester OliUnglaube007 Badream whisper' } }

  // TRANSPORT
  // { data: 'Transporter swapped Clipper with Edward Bishop.',attribs: { title: 'Veteran Godfather ', class: 'notice Veteran Godfather Transporter trans' } }

  // END
  // { data: 'End of Report', attribs: { class: 'end' } }

  let entries = []
  for (let i = 0; i < spans.length; i++) {
    sanitizeTitle(spans[i])
    sanitizeClass(spans[i])
    restructureClass(spans[i])
    restructureSystemSpan(spans[i])
    restructureDayChatSpan(spans[i], players)
    restructureOtherChatSpan(spans[i], players)
    restructureWhisperSpan(spans[i], players)
    restructureLastWillAndDeathNote(spans[i], players)
    if (spans[i].attribs) 
    if (spans[i].attribs.class.length == 1)
    { console.log(spans[i]); console.log() }
  }
}

function restructureLastWillAndDeathnote(span, players) {
  if (span.attribs) 
  if (span.attribs.class.length == 1)
}

function restructureWhisperSpan(span, players) {
  if (span.attribs) {
    if (span.attribs.class.length == 5) {
      if (span.attribs.class[0] != 'notice') {
        let whisper = span.data
        let index = whisper.indexOf(':')
        whisper = whisper.slice(index + 3)

        let from = span.attribs.class[2]
        let to = span.attribs.class[3]

        from = players[from].name
        to = players[to].name

        delete span.data
        delete span.attribs

        span.type = 'WHISPER'
        span.from = from
        span.to = to
        span.whisper = whisper
      }
    }
  }
}

function restructureOtherChatSpan(span, players) {
  if (span.attribs) {
    if (span.attribs.class.length == 3) {
      if (span.attribs.class[0] != 'notice') {

        let message = span.data
        let index = message.indexOf(':')
        message = message.slice(index + 2)

        let type = span.attribs.class[2]
        type = type.toUpperCase()

        let account = span.attribs.class[0]
        let name = players[account].name

        delete span.data
        delete span.attribs

        span.type = `${type} CHAT`
        span.author = name
        span.text = message
      }
    }
  }
}

function restructureDayChatSpan(span, players) {
  if (span.attribs) {
    if (span.attribs.class.length == 2) {
      let message = span.data
      let index = message.indexOf(':')
      message = message.slice(index + 2)

      let account = span.attribs.class[0]
      let name = players[account].name

      delete span.data
      delete span.attribs

      span.type = 'DAY CHAT'
      span.author = name
      span.text = message
    }
  }
}

function restructureSystemSpan(span) {
  switch (span.data) {
    case 'Lobby':
    case 'Players are choosing names':
    case 'Ranked Game.':
    case 'Defense':
    case 'Judgement':
    case 'GameOver':
    case 'Town has won.':
    case 'Mafia has won.':
    case 'End of Report':
      let data = span.data
      delete span.data
      delete span.attribs
      span.type = 'SYSTEM'
      span.text = data
      return
  }
  if (typeof span.data == 'string') {
    if (span.data.startsWith('Day ')) {
      let index = 'Day '.length
      let number = span.data.slice(index)
      number = Number(number)
      if (typeof number == 'number') {
        delete span.data
        delete span.attribs
        span.type = 'DAY'
        span.number = number
        return
      }
    }
    if (span.data.startsWith('Night ')) {
      let index = 'Night '.length
      let number = span.data.slice(index)
      number = Number(number)
      if (typeof number == 'number') {
        delete span.data
        delete span.attribs
        span.type = 'NIGHT'
        span.number = number
        return
      }
    }
  }
}

function sanitizeTitle(span) {
  if (span.attribs.title) {
    span.attribs.title = span.attribs.title.replace(/  /g, ' ')
    if (span.attribs.title.endsWith(' ')) {
      span.attribs.title = span.attribs.title.slice(0, -1)
    }
    if (span.attribs.title.length == 0 || span.attribs.title.length == 1) {
      delete span.attribs.title
    }
  }
}

function sanitizeClass(span) {
  if (span.attribs.class) {
    span.attribs.class = span.attribs.class.replace(/  /g, ' ')
    if (span.attribs.class.length == 0 || span.attribs.class.length == 1) {
      delete span.attribs.class
    }
  }
}

function restructureClass(span) {
  if (span.attribs.class) {
    span.attribs.class = span.attribs.class.split(' ')
  }
}

async function parseReport(reportId) {
  let HTML = await reportToString(reportId)
  let players = playerListFromHTML(HTML) // a player can be accessed by account or name
  let spans = getSpans(HTML)
  spans = spansToArrayOfEntries(spans, players)
}

//2501835
parseReport(2501835)