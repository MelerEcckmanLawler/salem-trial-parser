const cheerio = require('cheerio')
const fs = require('fs').promises

parseReport(2505949).then((report) => {
  for (let k in report.players) {
    /*
    will log each player twice because
    they are indexed by both account name
    and match name
    */
    console.log(report.players[k])
    console.log()
  }
  for (let i = 0; i < report.entries.length; i++) {
    if (report.entries[i].attribs) {
      console.warn('Need to make a restructure function for the following entry:')
    }
    console.log(report.entries[i])
    console.log()
  }
})

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
    let span
    let spanParent = spanParents[i]

    if (spanParent.children.length == 0) {
      continue
    }

    if (spanParent.attribs) {
      if (spanParent.attribs.title == '') {
        continue
      }
    }

    span = { data: spanParent.children[0].data }
    span.attribs = spanParent.attribs
    spans.push(span)
  }
  return spans
}

function spansToArrayOfEntries(spans, players) {
  let entries = []
  for (let i = 0; i < spans.length; i++) {
    let span = spans[i]
    sanitizeTitle(span)
    sanitizeClass(span)
    restructureClass(span)
    restructureSystemSpan(span)
    restructureDayChatSpan(span, players)
    restructureOtherChatSpan(span, players)
    restructureWhisperSpan(span, players)
    restructureLastWillAndDeathNote(span, players)
    restructureTitle(span)
    restructureHasBeenKilled(span, players)
    restructureWasAttackedBy(span, players)
    restructureVotes(span, players)
    restructureHasBeenKilled(span, players)
    restructureHasBeenLynched(span, players)
    restructureAttackedByAVeteran(span, players)
    restructureTransportation(span, players)
    restructureHasLeftTheGame(span, players)
    restructureDecidedToExecute(span, players)
    restructureInvestigated(span, players)
    restructureWitched(span, players)
    restructureSheriffChecked(span, players)
    restructureSerialKillerKilledJailorWhileInJail(span, players)
    restructureResurrection(span, players)
    restructureHasForgedWill(span, players)
    entries.push(span)
  }
  return entries
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
  let entries = spansToArrayOfEntries(spans, players)
  let match = { players: players, entries: entries }
  return match
}
