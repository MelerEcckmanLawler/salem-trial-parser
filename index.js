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

function spansToArrayOfEntries(spans) {
  // { data: 'Lobby', attribs: { class: 'stage' } }
  // { data: 'Players are choosing names', attribs: { class: 'stage' } }
  // { data: 'Ranked Game.', attribs: { title: '  ', class: 'notice' } }
  // { data: 'Fancy Dube: Hi', attribs: { title: 'Godfather2', class: 'DonParme Godfather2' } }
  // { data: 'Day 1', attribs: { class: 'time day' } }
  // { data: 'Night 2', attribs: { class: 'time night' } }
  // { data: 'Edward Bishop: Hey' ,attribs: { title: 'Godfather', class: 'OliUnglaube007 Godfather jail' } }
  // { data: 'William Hobbs: im escort', attribs: { title: 'Mafioso2', class: 'aglayin123 Mafioso2 mafia' } }
  // { data: 'flame investigated Spheal.',attribs: { title: 'Investigator  ', class: 'notice Investigator  Investigator' } }
  // { data: 'Spheal has been killed.', attribs: { title: 'Investigator  ', class: 'notice Investigator  death' } }
  // { data: undefined, attribs: { class: 'note','data-type': 'will', 'data-info': 'PHNwYW4gaWQ9J3dpbGxPd25lcic+U3BoZWFsKFF1YWtlTkxEKTo8L3NwYW4+U3BoZWFsJm5ic3A7LSZuYnNwO0ludmVzdGlnYXRvcjxiciAvPg08YnIgLz4NTjE6VmlnaWwmbmJzcDsoMTQpPGJyIC8+' } }
  // { data: 'Spheal: Ok Medium, straight down to business: Spheal - InvestigatorN1: Vigil (14) - Lookout, Forger, Witch', attribs: { title: 'Investigator', class: 'QuakeNLD Investigator dead' } }
  //{ data: 'Court: Medium Court here', attribs: { title: 'Medium', class: 'ClainS Medium seance' } }
  let entries = []
  for (let i = 0; i < spans.length; i++) {

  }
}

async function parseReport(reportId) {
  let HTML = await reportToString(reportId)
  let players = playerListFromHTML(HTML) // a player can be accessed by account or name
  let spans = getSpans(HTML)
  spans = spansToArrayOfEntries(spans)
}

//2501835
parseReport(2501835)