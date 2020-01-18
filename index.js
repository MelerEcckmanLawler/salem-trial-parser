const cheerio = require('cheerio')
const fs = require('fs').promises

module.exports = async function parseReport(filename) {
  let HTML = await reportToString(filename)
  if (HTML == 'Could not find any reports with that ID.') {
    console.log('Could not find any reports with that ID.')
    return
  }
  let players = playerListFromHTML(HTML)
  let metaData = getMetaData(HTML)
  let spans = getSpans(HTML, players, filename)
  let entries = spansToArrayOfEntries(spans, players)

  let playerNames = {}
  for (let k in players) {
    playerNames[players[k].name] = players[k]
    playerNames[players[k].name].killers = []
    playerNames[players[k].name].killed = []
    playerNames[players[k].name].lynched = []
    playerNames[players[k].name].resurrected = false
    playerNames[players[k].name].role = playerNames[players[k].name].role
      .replace('SerialKiller', 'Serial Killer')
      .replace('BodyGuard', 'Bodyguard')
      .replace('VampireHunter', 'Vampire Hunter')
      .replace('PotionMaster', 'Potion Master')
      .replace('HexMaster', 'Hex Master')
      .replace('CovenLeader', 'Coven Leader')
    playerNames[players[k].name].faction = roleToFaction(playerNames[players[k].name].role)
  }

  let time = 'D0'
  let ranked = false
  let lovers = false
  let VIP = false

  for (let i = 0; i < entries.length; i++) {
    let entry = entries[i]
    if (entry.attribs) {
      console.log(filename)
      console.log('\x1b[31m', 'RESTRUCTURE FUNCTION NEEDED FOR THE FOLLOWING ENTRY TYPE:', '\x1b[0m')
      console.log(entry)
    }

    if (entry.type == 'SYSTEM') {
      if (entry.text == 'Ranked Game.') {
        ranked = true
      }
      if (entry.text == 'Lovers Game.') {
        lovers = true
      }
      if (entry.text == 'VIP Game.') {
        VIP = true
      }
    }
    if (entry.type == 'NIGHT') {
      time = 'N' + entry.number + '.' + i
    }
    if (entry.type == 'DAY') {
      time = 'D' + entry.number + '.' + i
    }
    entry.time = time.split('.')[0] + '.' + i
    if (entry.type == 'HAS BEEN KILLED') {
      let name = entry.player
      if (name == '') { continue }
      let correctedTime = entry.time.replace('D', 'N')
      let correctedDigit = correctedTime.split('.')
      correctedDigit = correctedDigit[0].slice(1)
      correctedDigit = Number(correctedDigit)
      correctedDigit -= 1
      correctedTime = correctedTime.replace(/[0-9]+/, correctedDigit)
      playerNames[name].killed.push(correctedTime)
    }
    if (entry.type == 'WAS ATTACKED BY') {
      let name = entry.victim
      let attacker = entry.attacker
      if (name == '') { continue }
      if (playerNames[name] == undefined) {
        console.log('---------------------------------------------')
        console.log(name + ' <=== UNDEFINED!?')
        console.log(filename)
        console.log('---------------------------------------------')
      }
      playerNames[name].killers.push(attacker
        .replace('SerialKiller', 'Serial Killer')
        .replace('BodyGuard', 'Bodyguard')
        .replace('VampireHunter', 'Vampire Hunter')
        .replace('PotionMaster', 'Potion Master')
        .replace('HexMaster', 'Hex Master')
        .replace('CovenLeader', 'Coven Leader')
      )
    }
    if (entry.type == 'KILLED VISITING SERIAL KILLER') {
      let name = entry.name
      if (name == '') { continue }
      playerNames[name].killers.push('Serial Killer')
    }
    if (entry.type == 'IGNITED BY ARSONIST') {
      let name = entry.name
      if (name == '') { continue }
      playerNames[name].killers.push('Arsonist')
    }
    if (entry.type == 'DIED GUARDING SOMEONE') {
      let name = entry.name
      if (name == '') { continue }
      playerNames[name].killers.push('Guard')
    }
    if (entry.type == 'DIED FROM GUILT') {
      let name = entry.name
      if (name == '') { continue }
      playerNames[name].killers.push('Guilt')
    }
    if (entry.type == 'EXECUTED') {
      let name = entry.name
      if (name == '') { continue }
      playerNames[name].killers.push('Jailor')
    }
    if (entry.type == 'RESURRECTION') {
      let name = entry.name
      if (name == '') { continue }
      playerNames[name].resurrected = entry.time
    }
    if (entry.type == 'LYNCH') {
      let name = entry.name
      if (name == '') { continue }
      playerNames[name].lynched.push(entry.time)
      playerNames[name].killed.push(entry.time)
    }
    if (entry.type == 'LEFT GAME') {
      let name = entry.name
      if (name == '') { continue }
      playerNames[name].left = entry.time
    }
    if (entry.type == 'BITTEN BY VAMPIRE') {
      let name = entry.name
      if (name == '') { continue }
      playerNames[name].converted = entry.time
    }
    if (entry.type == 'MAYOR REVEAL') {
      let name = entry.name
      if (name == '') { continue }
      playerNames[name].revealed = entry.time
    }
  }

  let objects = []
  let voting = false
  let votes = []
  let defense = false
  let judgement = false
  let selfDefense = { defensePeriod: [], judgementPeriod: [] }
  let accused = null
  for (let i = 0; i < entries.length; i++) {
    let entry = entries[i]
    if (entry.type == 'SYSTEM' && entry.text == 'Defense') {
      defense = true
    }
    if (entry.type == 'DAY CHAT') {
      if (defense) {
        accused = entry.author
      }
      if (defense) {
        if (entry.author == accused) {
          selfDefense.defensePeriod.push(entry.text)
        }
      }
      if (judgement) {
        if (entry.author == accused) {
          selfDefense.judgementPeriod.push(entry.text)
        }
      }
    }
    if (entry.type == 'SYSTEM' && entry.text == 'Judgement') {
      defense = false
      judgement = true
    }
    if (entry.type == 'VOTE') {
      judgement = false
      voting = true
      votes.push({ author: entry.name, vote: entry.vote })
      if (players[entry.name] == undefined) {
        console.log('---------------------------------------------')
        console.log(entry.name + ' <=== UNDEFINED!?')
        console.log(filename)
        console.log('---------------------------------------------')
      }
      if (players[entry.name].role == 'Mayor') {
        let mayor = players[entry.name]
        if (mayor.revealed) {
          let revealed = mayor.revealed.split('.')[1]
          revealed = Number(revealed)
          let now = entry.time
          now = now.split('.')[1]
          now = Number(now)
          if (revealed < now) {
            votes.push({ author: entry.name, vote: entry.vote, mayor: 'double' })
            votes.push({ author: entry.name, vote: entry.vote, mayor: 'triple' })
          }
        }
      }
    } else {
      if (voting) {
        voting = false
        let guilties = votes.filter((a) => { return a.vote == 'guilty' }).length
        let innoes = votes.filter((a) => { return a.vote == 'innocent' }).length
        let abstains = votes.filter((a) => { return a.vote == 'abstain' }).length
        let total = votes.length - abstains
        let outcome
        if (guilties > total / 2) { outcome = 'lynched' } else { outcome = 'pardoned' }
        if (accused === null && outcome == 'lynched') {
          for (let j = i; j < entries.length; j++) {
            let entry2 = entries[j]
            if (entry2.type == 'LYNCH') {
              accused = entry2.name
              break
            }
          }
        }
        if (accused === null) {
          let index = Number(entry.time.split('.')[1])
          let alive = []
          for (let k in players) {
            let player = players[k]
            let firstDeath, secondDeath, resurrection
            if (player.resurrected.length) {
              resurrection = player.resurrected.split('.')[1]
              resurrection = Number(resurrection)
            }
            if (player.killed.length == 0) { alive.push(player.name); continue }
            if (player.killed.length) {
              firstDeath = player.killed[0]
              firstDeath = player.killed[0].split('.')[1]
              firstDeath = Number(firstDeath)
              if (player.killed.length === 1) {
                if (!player.resurrected) {
                  if (firstDeath > index) { alive.push(player.name); continue }
                }
                if (player.resurrected.length) {
                  if (resurrection < index) { alive.push(player.name); continue }
                }
              }
              if (player.killed.length == 2) {
                secondDeath = player.killed[1].split('.')[1]
                secondDeath = Number(secondDeath)
                if (index < firstDeath || (index > resurrection && index < secondDeath)) {
                  alive.push(player.name)
                }
              }
            }
          }
          let voted = []
          for (let j = 0; j < votes.length; j++) {
            voted.push(votes[j].author)
          }
          for (let j = 0; j < alive.length; j++) {
            if (!voted.includes(alive[j])) {
              accused = alive[j]
              break
            }
          }
        }
        let object = { type: 'TRIAL OUTCOME', accused: accused, defense: selfDefense, votes: votes, outcome: outcome, time: entry.time }
        objects.push(object)
        if (accused == null) {
          console.log(reportId)
          console.log(object)
          console.log('ERROR: Unable to use process of elimination to determine the identity of the player on trial.  Probably has something to do with somebody being resurrected this game.')
        }
        votes = []
        selfDefense = { defensePeriod: [], judgementPeriod: [] }
        accused = null
      }
    }
  }

  for (let i = 0; i < objects.length; i++) {
    let index = Number(objects[i].time.split('.')[1]) + i
    entries.splice(index, 0, objects[i])
  }

  let match = { players: playerNames, entries: entries, ranked: ranked, lovers: lovers, VIP: VIP, metaData: metaData }

  // Here comes very ugly code that relabels the second GF who died second (or never) as Mafioso
  // and 'mafiosos' who started as random mafia are correctly labeled as such
  // also duplicate roles are numbered 1, 2, 3, etc. e.g. Lookout1 Lookout2
  players = match.players

  let ROLES = []
  let J = 0
  for (let name in players) {
    ROLES.push(players[name].role)
    J++
  }

  let map = {};
  let count = ROLES.map(function (val) {
    return map[val] = (typeof map[val] === 'undefined') ? 1 : map[val] + 1;
  });

  let newArray = ROLES.map(function (val, index) {
    if (map[val] === 1) {
      return val;
    } else {
      return val + '' + count[index];
    }
  });

  J = 0
  for (let name in players) {
    players[name].role = newArray[J]
    J++
  }

  let gf1 = false
  let gf2 = false
  for (let name in players) {
    let player = players[name]
    if (player.role == 'Godfather1') {
      gf1 = player
    }
    if (player.role == 'Godfather2') {
      gf2 = player
    }
  }
  if (gf1 && gf2) {
    let death1 = Infinity
    let death2 = Infinity
    if (gf1.killed.length) {
      death1 = Number(gf1.killed[0].split('.')[1])
    }
    if (gf2.killed.length) {
      death2 = Number(gf2.killed[0].split('.')[1])
    }
    if (death1 < death2) { gf1.role = 'Godfather'; gf2.role = 'Mafioso' }
    if (death2 < death1) { gf2.role = 'Godfather'; gf1.role = 'Mafioso' }
  }
  let mafia = []
  for (let name in players) {
    if (players[name].role.includes('Mafioso')) {
      players[name].role = 'Mafioso'
      let entry = { name: name, death: Infinity }
      if (players[name].killed.length) {
        entry.death = Number(players[name].killed[0].split('.')[1])
      }
      mafia.push(entry)
    }
  }
  if (mafia.length > 1) {
    mafia = mafia.sort((a, b) => (a.death > b.death) ? 1 : -1)
    for (let i = 1; i < mafia.length; i++) {
      players[mafia[i].name].role = 'Random Mafia'
    }
  }
  // finished ugly role-correcting code
  return match
}

async function reportToString(filename) {
  let HTML = await fs.readFile(filename, `utf8`)
  return HTML
}

let MAFIA = `Blackmailer
Consigliere
Consort
Disguiser
Framer
Forger
Godfather
Janitor
Mafioso
Hypnotist
Ambusher`.split('\n')

let TOWN = `Bodyguard
Crusader
Psychic
Doctor
Escort
Investigator
Jailor
Lookout
Mayor
Medium
Retributionist
Sheriff
Spy
Transporter
Trapper
Veteran
Tracker
Vigilante
Vampire Hunter`.split('\n')

let NEUTRAL = `Amnesiac
Arsonist
Executioner
Jester
Serial Killer
Survivor
Witch
Werewolf
Vampire
Guardian Angel
Pirate
Plaguebearer
Pestilence
Juggernaut`.split('\n')

let COVEN = `Coven Leader
Hex Master
Medusa
Necromancer
Poisoner
Potion Master`.split('\n')

function roleToFaction(role) {
  if (TOWN.includes(role)) { return 'Town' }
  if (MAFIA.includes(role)) { return 'Mafia' }
  if (NEUTRAL.includes(role)) { return 'Neutral' }
  if (COVEN.includes(role)) { return 'Coven' }
  console.log('\x1b[31m', 'role', '\x1b[0m');
}

function getMetaData(HTML) {
  let $ = cheerio.load(HTML)
  let judgement = $('div#splash')[0].children[1].children[0].data
  if (judgement.includes('innocent')) { judgement = 'innocent' }
  if (judgement.includes('guilty')) { judgement = 'guilty' }
  if (judgement.includes('closed')) { judgement = 'none' }
  let reportedPlayer = $('span.reportedPlayer').first().contents().filter(function () {
    return this.type === 'text';
  }).text();
  let reportDate = $('span.reportDate').first().contents().filter(function () {
    return this.type === 'text';
  }).text();
  let numReports = $('span.numReports').first().contents().filter(function () {
    return this.type === 'text';
  }).text();
  let reportReason = $('span.reportReason').first().contents().filter(function () {
    return this.type === 'text';
  }).text();
  let reportDescription = $('span.reportDescription').first().contents().filter(function () {
    return this.type === 'text';
  }).text();
  return {
    judgement: judgement,
    reportedPlayer: reportedPlayer,
    reportDate: reportDate,
    numReports: numReports,
    reportReason: reportReason,
    reportDescription: reportDescription
  }
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

function getSpans(HTML, players, filename) {
  let $ = cheerio.load(HTML)
  let spanParents = $('#reportContent').find('span')
  let spans = []
  let previousSpan = false
  for (let i = 0; i < spanParents.length; i++) {
    let span
    let spanParent = spanParents[i]

    if (spanParent.children.length == 0) {
      continue
    }

    span = { data: spanParent.children[0].data }
    span.attribs = spanParent.attribs

    if (span.data === span.attribs.class.trim()) {
      let data = span.data
      let name = previousSpan.data
      name = name.split(':')[0].trim()
      if (players[name] !== undefined) {
        span = JSON.parse(JSON.stringify(previousSpan, null))
        span.data = name + ': ' + data
      }
    }

    if (span.data !== undefined) {
      if (span.data.replace(/\\\)/g, '').replace(/\\\(/g, '').includes(span.attribs.class.replace(/coven/g, '').trim())) {
        let data = span.data
        let name = previousSpan.data
        name = name.split(':')[0].trim()
        if (players[name] !== undefined) {
          span = JSON.parse(JSON.stringify(previousSpan, null))
          span.data = name + ': ' + data
        }
      }
    }

    spans.push(span)
    previousSpan = span
  }
  return spans
}

function spansToArrayOfEntries(spans, players) {
  let entries = []
  for (let i = 0; i < spans.length; i++) {
    let span = spans[i]
    removeNewLines(span)
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
    restructureVisitedASerialKiller(span, players)
    restructureResurrection(span, players)
    restructureHasForgedWill(span, players)
    restructureDiedFromHeartBreak(span, players)
    restructureDiedGuardingSomeone(span, players)
    restructureDiedFromGuilt(span, players)
    restructureIgnitedByArsonist(span, players)
    restructureBittenByVampire(span, players)
    restructureAmnesiacRemembered(span, players)
    restructureVisitedAVampireHunter(span, players)
    restructureStakedByAVampireHunter(span, players)
    restructureConverted(span, players)
    restructureMayorReveal(span)
    entries.push(span)
  }
  return entries
}

function removeNewLines(span) {
  if (span.data) {
    span.data = span.data.replace(/\n/g, ' ')
  }
}

function restructureConverted(span, players) {
  if (span.attribs) {
    if (span.attribs.class) {
      if (span.attribs.class.length == 3) {
        if (span.attribs.class[0] == 'notice')
          if (span.attribs.class[span.attribs.class.length - 1] == 'convert')
            if (span.data.includes(' was converted from being a ')) {
              let data = span.data
              let index = data.indexOf(' was converted from being a ')
              let name = data.slice(0, index)
              let role = data
                .slice(index, -1)
                .replace(' was converted from being a ', '')
                .replace('SerialKiller', 'Serial Killer')
                .replace('BodyGuard', 'Bodyguard')
                .replace('VampireHunter', 'Vampire Hunter')
                .replace('PotionMaster', 'Potion Master')
                .replace('HexMaster', 'Hex Master')
                .replace('CovenLeader', 'Coven Leader')
              delete span.data
              delete span.attribs
              span.type = 'CONVERTED'
              span.name = name
              span.originalRole = role;
              let player = Object.values(players).filter(player => player.name == name)[0]
              player.role = role;
            }
      }
    }
  }
}

function restructureStakedByAVampireHunter(span, players) {
  if (span.attribs) {
    if (span.attribs.class) {
      if (span.attribs.class.length == 1) {
        if (span.attribs.class[0] == 'notice')
          if (span.data.includes(' was staked by a VampireHunter.')) {
            let data = span.data
            let index = data.indexOf(' was staked by a VampireHunter.')
            let name = data.slice(0, index)
            delete span.data
            delete span.attribs
            span.type = 'STAKED BY A VAMPIRE HUNTER'
            span.name = name
          }
      }
    }
  }
}

function restructureVisitedAVampireHunter(span, players) {
  if (span.attribs) {
    if (span.attribs.class) {
      if ((span.attribs.class.length == 1) || (span.attribs.class.length == 3)) {
        if (span.attribs.class[0] == 'notice')
          if (span.data.includes(' visited a VampireHunter.')) {
            let data = span.data
            let index = data.indexOf(' visited a VampireHunter.')
            let name = data.slice(0, index)
            delete span.data
            delete span.attribs
            span.type = 'VISITED A VAMPIRE HUNTER'
            span.name = name
          }
      }
    }
  }
}

function restructureAmnesiacRemembered(span, players) {
  if (span.attribs) {
    if (span.attribs.class) {
      if (span.attribs.class.length == 1) {
        if (span.attribs.class[0] == 'notice')
          if (span.data.includes(' has remembered they were ')) {
            let data = span.data
            let index = data.indexOf(' has remembered they were ')
            let name = data.slice(0, index)
            let index2 = index + ' has remembered they were '.length
            let role = data.slice(index2)
            role = role.replace('.', '')
            delete span.data
            delete span.attribs
            span.type = 'AMNESIAC REMEMBERED'
            span.name = name
            span.role = role
          }
      }
    }
  }
}

function restructureIgnitedByArsonist(span, players) {
  if (span.attribs) {
    if (span.attribs.class) {
      if (span.attribs.class.length == 1) {
        if (span.attribs.class[0] == 'notice')
          if (span.data.endsWith(' was ignited by an Arsonist.')) {
            let data = span.data
            let index = data.indexOf(' was ignited by an Arsonist.')
            let name = data.slice(0, index)
            delete span.data
            delete span.attribs
            span.type = 'IGNITED BY ARSONIST'
            span.name = name
          }
      }
    }
  }
}

function restructureBittenByVampire(span, players) {
  if (span.attribs) {
    if (span.attribs.class) {
      if (span.attribs.class.length > 1) {
        if (span.attribs.class[0] == 'Vampire')
          if (span.data.startsWith('*Vampires have bit ')) {
            let data = span.data
            let name = span.data;
            name = name.replace('*Vampires have bit ', '')
            name = name.replace('(Vampire).', '')
            delete span.data
            delete span.attribs
            span.type = 'BITTEN BY VAMPIRE'
            span.name = name
          }
      }
    }
  }
}

function restructureDiedFromGuilt(span, players) {
  if (span.attribs) {
    if (span.attribs.class) {
      if (span.attribs.class[0] == 'notice')
        if (span.data.endsWith(' died from guilt over shooting a Town member.')) {
          let data = span.data
          let index = data.indexOf(' died from guilt over shooting a Town member.')
          let name = data.slice(0, index)
          delete span.data
          delete span.attribs
          span.type = 'DIED FROM GUILT'
          span.name = name
        }


    }
  }
}

function restructureDiedGuardingSomeone(span, players) {
  if (span.attribs) {
    if (span.attribs.class) {
      if ((span.attribs.class.length == 1) || (span.attribs.class.length == 3)) {
        if (span.attribs.class[0] == 'notice') {
          if (span.data.endsWith(' died guarding someone.')) {
            let data = span.data
            let index = data.indexOf(' died guarding someone.')
            let name = data.slice(0, index)
            delete span.data
            delete span.attribs
            span.type = 'DIED GUARDING SOMEONE'
            span.name = name
          }
        }
      }
    }
  }
}

function restructureDiedFromHeartBreak(span, players) {
  if (span.attribs) {
    if (span.attribs.class[0] == 'notice') {
      if (span.data.endsWith(' died from heartbreak.')) {
        let data = span.data
        let index = data.indexOf(' died from heartbreak.')
        let name = data.slice(0, index)
        delete span.data
        delete span.attribs
        span.type = 'DIED FROM HEARTBREAK'
        span.name = name
      }
    }
  }
}

function restructureHasForgedWill(span, players) {
  if (span.attribs) {
    if (span.attribs.class.length == 1) {
      if (span.attribs.class[0] == 'notice') {
        if (span.data.includes(' has forged the will.')) {
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
}

function restructureResurrection(span, players) {
  if (span.attribs) {
    if (span.attribs.class.length == 2 || span.attribs.class.length == 3) {
      if (span.attribs.class[0] == 'notice')
        if (span.attribs.class[span.attribs.class.length - 1] == 'revived') {
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

function restructureVisitedASerialKiller(span, players) {
  if (span.attribs) {
    if (span.attribs.class) {
      if (span.attribs.class[0] == 'notice') {
        if (span.data.endsWith(' visited a SerialKiller.')) {
          let data = span.data
          let index = data.indexOf(' visited a SerialKiller.')
          let name = data.slice(0, index)

          delete span.data
          delete span.attribs

          span.type = 'KILLED VISITING SERIAL KILLER'
          span.name = name
        }
      }
    }
  }
}

function restructureSheriffChecked(span, players) {
  if (span.attribs) {
    if (span.attribs.class.length == 2 || span.attribs.class.length == 3) {
      if (span.attribs.class[0] == 'notice') {
        if (span.attribs.class[span.attribs.class.length - 1] == 'Sheriff') {
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
    if (span.attribs.class.length == 3 || span.attribs.class.length == 4 || span.attribs.class.length == 5) {
      if (span.attribs.class[0] == 'notice') {
        if (span.attribs.class[span.attribs.class.length - 1] == 'control') {
          let data = span.data
          let target1
          let target2
          let index = 'Witch made '.length
          let index2 = data.indexOf(' target ')
          let index3 = index2 + ' target '.length
          //Witch made |exes |target |target Lock.

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
      if (span.attribs.class[span.attribs.class.length - 1] == 'Investigator') {
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
    if (span.attribs.class.length == 2 || span.attribs.class.length == 3 || span.attribs.class.length == 4) {
      if ((span.attribs.class[span.attribs.class.length - 1] == 'jail') ||
        (span.attribs.class[span.attribs.class.length - 1] == 'death')) {
        if (span.data.includes(' decided to execute ')) {
          let data = span.data
          let index = data.indexOf(' decided to execute ')
          index += ' decided to execute '.length
          let name = data.slice(index, -1)

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
    if (span.attribs.class)
      if (span.attribs.class[0] == 'notice') {
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
    if (span.attribs.class.length == 3 || span.attribs.class.length == 4 || span.attribs.class.length == 5) {
      if (span.attribs.class[span.attribs.class.length - 1] == 'trans') {
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
    if (span.attribs.class) {
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
    if (span.attribs.class)
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
    if (span.attribs.class) {
      let data = span.data
      if (data.includes(' was attacked by ')) {
        let index = data.indexOf(' was attacked by ')
        let victim = data.slice(0, index)
        let length = victim.length + ' was attacked by '.length
        let attacker = data.slice(length)
        attacker = attacker.replace('the ', '')
        attacker = attacker.replace('a ', '')
        attacker = attacker.replace('an ', '')
        attacker = attacker.replace('.', '')

        delete span.data
        delete span.attribs

        span.type = 'WAS ATTACKED BY'
        span.victim = victim
        span.attacker = attacker
          .replace('SerialKiller', 'Serial Killer')
          .replace('BodyGuard', 'Bodyguard')
          .replace('VampireHunter', 'Vampire Hunter')
          .replace('PotionMaster', 'Potion Master')
          .replace('HexMaster', 'Hex Master')
          .replace('CovenLeader', 'Coven Leader')
      }
    }
}

function restructureHasBeenKilled(span, players) {
  if (span.attribs)
    if (span.attribs.class) {
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
      span.attribs.title = span.attribs.title.replace(/Guardian Angel/g, 'GuardianAngel')
      span.attribs.title = span.attribs.title.replace(/Coven Leader/g, 'CovenLeader')
      span.attribs.title = span.attribs.title.replace(/Potion Master/g, 'PotionMaster')
      span.attribs.title = span.attribs.title.split(' ')
      for (let i = 0; i < span.attribs.title.length; i++) {
        if (span.attribs.title[i] === '') {
          span.attribs.title.splice(i, 1)
        }
      }
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
    if (span.attribs.class.length > 2) {
      if (span.attribs.class[span.attribs.class.length - 1] == 'whisper') {
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
        if (players[account] === undefined) { return }
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
      if ((span.data.includes(': ') || (span.data.endsWith(':') &&
        (span.data.indexOf(':') == (span.data.length - 1)) ||
        (span.data.indexOf(':') == (span.data.length - 2)))) ||
        (players[span.data.slice(0, span.data.indexOf(':'))])) {
        let message = span.data
        let index = message.indexOf(':')
        message = message.slice(index + 2)

        let account = span.attribs.class[0]

        let name
        if (span.attribs.class[1] == 'lobby') {
          name = span.attribs.class[0]
        } else {
          if (players[account] === undefined) { return }
          name = players[account].name
        }

        delete span.data
        delete span.attribs

        span.type = 'DAY CHAT'
        span.author = name
        span.text = message
      }
    }
  }
}

function restructureSystemSpan(span) {
  switch (span.data) {
    case 'Lobby':
    case 'Players are choosing names':
    case 'Ranked Game.':
    case 'Lovers Game.':
    case 'VIP Game.':
    case 'Defense':
    case 'Judgement':
    case 'ERROR.':
    case 'GameOver':
    case 'Town has won.':
    case 'Mafia has won.':
    case 'Neutrals has won.':
    case 'Coven has won.':
    case 'Arsonist has won.':
    case 'Werewolf has won.':
    case 'SerialKiller has won.':
    case 'Jester has won.':
    case 'Pestilence has won.':
    case 'Vampire has won.':
    case 'Jester has won.':
    case 'Plaguebearer has won.':
    case 'Pestilence has won.':
    case 'Pirate has won.':
    case 'Witch has won.':
    case 'Juggernaut has won.':
    case 'Executioner has won.':
    case 'Survivor has won.':
    case 'Stalemate.':
    case 'Draw.':
    case 'End of Report':
      let data = span.data
        .replace('SerialKiller', 'Serial Killer')
        .replace('BodyGuard', 'Bodyguard')
        .replace('VampireHunter', 'Vampire Hunter')
        .replace('PotionMaster', 'Potion Master')
        .replace('HexMaster', 'Hex Master')
        .replace('CovenLeader', 'Coven Leader')
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
      if (/^\d+$/.test(number)) {
        number = Number(number)
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
      if (/^\d+$/.test(number)) {
        number = Number(number)
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
    span.attribs.class = span.attribs.class.replace(/Guardian Angel/g, 'GuardianAngel')
    span.attribs.class = span.attribs.class.replace(/Coven Leader/g, 'CovenLeader')
    span.attribs.class = span.attribs.class.replace(/Potion Master/g, 'PotionMaster')
    span.attribs.class = span.attribs.class.split(' ')
    for (let i = 0; i < span.attribs.class.length; i++) {
      if (span.attribs.class[i] === '') {
        span.attribs.class.splice(i, 1)
      }
    }
  }
}

function restructureMayorReveal(span) {
  //<span title='' class='notice'>PLAYERNAMEHERE has revealed themselves as the Mayor.</span>
  if (span.attribs) {
    if (span.attribs.title == '') {
      if (span.attribs.class.length) {
        if (span.attribs.class[0] == 'notice') {
          if (span.data.endsWith(' has revealed themselves as the Mayor.')) {
            let data = span.data
            let index = data.indexOf(' has revealed themselves as the Mayor.')
            let name = data.slice(0, index)
            delete span.data
            delete span.attribs
            span.type = 'MAYOR REVEAL'
            span.name = name
          }
        }
      }
    }
  }
}

