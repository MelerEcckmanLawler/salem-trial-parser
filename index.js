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

  //Godfather2 is an actual role! So is Investigator2, etc.

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
  for (let k in players) {
    console.log(players[k].name, players[k].role)
  }
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
    restructureTitle(spans[i])
    restructureHasBeenKilled(spans[i], players)
    restructureWasAttackedBy(spans[i], players)
    restructureVotes(spans[i], players)
    restructureHasBeenKilled(spans[i], players)
    restructureHasBeenLynched(spans[i], players)
    restructureAttackedByAVeteran(spans[i], players)
    restructureTransportation(spans[i], players)
    restructureHasLeftTheGame(spans[i], players)
    restructureDecidedToExecute(spans[i], players)
    restructureInvestigated(spans[i], players)
    restructureWitched(spans[i], players)
    restructureSheriffChecked(spans[i], players)
    restructureSerialKillerKilledJailorWhileInJail(spans[i], players)
    restructureResurrection(spans[i], players)
    restructureHasForgedWill(spans[i], players)
    //if (spans[i].attribs)
    //if (spans[i].attribs.class.length == 1)
    //if (spans[i].attribs.class[0] == 'notice')
    { console.log(spans[i]); console.log() }
  }
}

function restructureHasForgedWill(span, players) {
  if (span.attribs) {
    if (span.attribs.class.length == 1) {
      if (span.attribs.class[0] == 'notice') {
        let data = span.data
        let perpetrator = data.replace(' has forged the will.', '')

        delete span.data
        delete span.attribs

        span.type = 'FORGERY'
        span.perpetrator = perpetrator
      }
    }
  }
}

function restructureResurrection(span, players) {
  if (span.attribs) {
    if (span.attribs.class.length == 3) {
      if (span.attribs.class[0] == 'notice') {
        if (span.data.endsWith(' has been resurrected.')) {
          let data = span.data
          let index = data.indexOf(' has been resurrected.')
          let name = data.slice(0, index)

          delete span.data
          delete span.attribs

          span.type = 'RESURRECTION'
          span.name = name
        }
      }
    }
  }
}

function restructureSerialKillerKilledJailorWhileInJail(span, players) {
  if (span.attribs) {
    if (span.attribs.class.length == 1) {
      if (span.attribs.class[0] == 'notice') {
        if (span.data.endsWith(' visited a SerialKiller.')) {
          let data = span.data
          let index = data.indexOf(' visited a SerialKiller.')
          let name = data.slice(0, index)

          delete span.data
          delete span.attribs

          span.type = 'JAILOR KILLED BY JAILED SERIAL KILLER'
          span.name = name
        }
      }
    }
  }
}

function restructureSheriffChecked(span, players) {
  if (span.attribs) {
    if (span.attribs.class.length == 3) {
      if (span.attribs.class[0] == 'notice') {
        if (span.attribs.class[2] == 'Sheriff') {
          if (span.data.includes(' checked ')) {
            let data = span.data
            let index = data.indexOf(' checked ')
            let name = data.slice(0, index)
            let index2 = index + ' checked '.length
            let target = data.slice(index2, -1)

            delete span.data
            delete span.attribs

            span.type = 'SHERIFF CHECK'
            span.name = name
            span.target = target
          }
        }
      }
    }
  }
}

function restructureWitched(span, players) {
  if (span.attribs) {
    if (span.attribs.class.length == 5) {
      if (span.attribs.class[0] == 'notice') {
        if (span.attribs.class[4] == 'control') {
          let data = span.data
          let target1
          let target2
          let index = 'Witch made '.length
          let index2 = data.indexOf(' target ')
          let index3 = index2 + ' target '.length

          target1 = data.slice(index, index2)
          target2 = data.slice(index3, -1)

          delete span.data
          delete span.attribs

          span.type = 'WITCHED'
          span.target1 = target1
          span.target2 = target2
        }
      }
    }
  }
}

function restructureInvestigated(span, players) {
  if (span.attribs) {
    if (span.attribs.class[0] == 'notice') {
      if (span.attribs.class[2] == 'Investigator') {
        let data = span.data
        let index = data.indexOf(' investigated ')
        let name = data.slice(0, index)
        let index2 = index + ' investigated '.length
        let target = data.slice(index2, -1)

        delete span.data
        delete span.attribs

        span.type = 'INVESTIGATED'
        span.name = name
        span.target = target
      }
    }
  }
}

function restructureDecidedToExecute(span, players) {
  if (span.attribs) {
    if (span.attribs.class.length == 4) {
      if (span.attribs.class[3] == 'jail') {
        if (span.data.includes(' decided to execute ')) {
          let data = span.data
          let index = data.indexOf(' decided to execute ')
          index += ' decided to execute '.length
          let name = data.slice(index)

          delete span.data
          delete span.attribs

          span.type = 'EXECUTED'
          span.name = name
        }
      }
    }
  }
}

function restructureHasLeftTheGame(span, players) {
  if (span.attribs) {
    if (span.attribs.class.length == 1) {
      let data = span.data
      if (data.endsWith(' has left the game.')) {
        let name = data.replace(' has left the game.', '')
        delete span.data
        delete span.attribs

        span.type = 'LEFT GAME'
        span.name = name
      }
    }
  }
}

function restructureTransportation(span, players) {
  if (span.attribs) {
    if (span.attribs.class.length == 5) {
      if (span.attribs.class[4] == 'trans') {
        let data = span.data
        let index1 = 'Transporter swapped '.length
        let index2 = data.indexOf(' with ')

        let name1 = data.slice(index1, index2)

        let index3 = 'Transporter swapped '.length + name1.length + ' with '.length

        let name2 = data.slice(index3, -1)

        delete span.data
        delete span.attribs

        span.type = 'TRANSPORTATION'
        span.player1 = name1
        span.player2 = name2
      }
    }
  }
}

function restructureAttackedByAVeteran(span, players) {
  if (span.attribs)
    if (span.attribs.title) {
      let data = span.data
      if (data.includes(' attacked by a Veteran.')) {
        let index = data.indexOf(' attacked by ')
        let victim = data.slice(0, index)

        delete span.data
        delete span.attribs

        span.type = 'WAS ATTACKED BY'
        span.victim = victim
        span.attacker = 'Veteran'
      }
    }
}

function restructureHasBeenLynched(span, players) {
  if (span.attribs) {
    let data = span.data
    if (data.endsWith(' has been lynched.')) {
      let index = data.indexOf(' has been lynched.')
      let name = data.slice(0, index)

      delete span.data
      delete span.attribs

      span.type = 'LYNCH'
      span.name = name
    }
  }
}

function restructureVotes(span, players) {
  if (span.attribs)
    if (span.attribs.class.length == 1)
      if (span.attribs.class[0] == 'notice') {
        let data = span.data
        let vote
        let index
        let name

        if (data.endsWith(' voted guilty.')) {
          vote = 'guilty'
          index = data.indexOf(' voted guilty.')
          name = data.slice(0, index)
        }

        if (data.endsWith(' voted innocent.')) {
          vote = 'innocent'
          index = data.indexOf(' voted innocent.')
          name = data.slice(0, index)
        }

        if (data.endsWith(' abstained.')) {
          vote = 'abstain'
          index = data.indexOf(' abstained.')
          name = data.slice(0, index)
        }

        if (vote !== undefined) {
          delete span.data
          delete span.attribs

          span.type = 'VOTE'
          span.name = name
          span.vote = vote

        }
      }
}

function restructureWasAttackedBy(span, players) {
  if (span.attribs)
    if (span.attribs.title) {
      let data = span.data
      if (data.includes(' was attacked by ')) {
        let index = data.indexOf(' was attacked by ')
        let victim = data.slice(0, index)
        let length = victim.length + ' was attacked by '.length
        let attacker = data.slice(length)
        attacker = attacker.replace('the ', '')
        attacker = attacker.replace('a ', '')
        attacker = attacker.replace('an ', '')

        delete span.data
        delete span.attribs

        span.type = 'WAS ATTACKED BY'
        span.victim = victim
        span.attacker = attacker
      }
    }
}

function restructureHasBeenKilled(span, players) {
  if (span.attribs)
    if (span.attribs.title) {
      let data = span.data
      if (data.endsWith(' has been killed.')) {
        let index = data.indexOf(' has been killed.')
        let name = data.slice(0, index)
        delete span.data
        delete span.attribs
        span.type = 'HAS BEEN KILLED'
        span.player = name
      }
    }
}

function restructureTitle(span, players) {
  if (span.attribs)
    if (span.attribs.title) {
      span.attribs.title = span.attribs.title.split(' ')
    }
}

function restructureLastWillAndDeathNote(span, players) {
  if (span.attribs)
    if (span.attribs.class.length == 1)
      if (span.attribs.class[0] == 'note') {
        let type = span.attribs['data-type']
        let base64 = span.attribs['data-info']
        delete span.data
        delete span.attribs

        type = type.replace('note', 'DEATH NOTE')
        type = type.replace('will', 'LAST WILL')

        span.type = type
        span.base64 = base64
      }
}

function restructureWhisperSpan(span, players) {
  if (span.attribs) {
    if (span.attribs.class.length == 5) {
      if (span.attribs.class[0] != 'notice') {
        let whisper = span.data
        let index = whisper.indexOf(':')
        whisper = whisper.slice(index + 2)

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
//2504760
//2504771
//2505868
//2505930
parseReport(2505930)