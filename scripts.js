const BACKEND_URL = 'https://nom-gaming-backend.onrender.com' // live backend
///const BACKEND_URL = 'http://localhost:3000' // test backend

let clients = []
let dirty = false

async function fetchClients() {
  try {
    const res = await fetch(`${BACKEND_URL}/clients`)
    clients = await res.json()
    renderTable()
  } catch (err) {
    console.error('Failed to fetch clients', err)
  }
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function getRemainingSeconds(client) {
  if (client.paused || !client.startTimestamp)
    return Math.max(0, client.totalSeconds - client.elapsedSeconds)

  const start = new Date(client.startTimestamp).getTime()
  const now = Date.now()
  const extraElapsed = Math.floor((now - start) / 1000)
  return Math.max(0, client.totalSeconds - (client.elapsedSeconds + extraElapsed))
}

function renderTable() {
  const tbody = document.querySelector('#clientsTable tbody')
  const filter = document.getElementById('filterStatus')?.value || 'all'
  tbody.innerHTML = ''

  clients.forEach(client => {
    const remaining = getRemainingSeconds(client)

    if (filter === 'active' && remaining === 0) return
    if (filter === 'inactive' && remaining > 0) return

    const row = document.createElement('tr')
    row.id = `row-${client.id}`
    row.innerHTML = `
      <td>${client.role}</td>
      <td>${client.name}</td>
      <td>${client.phone || ''}</td>
      <td style="background-color: ${client.paused ? '' : '#d4edda'}">
        <button onclick="toggleTimer('${client.id}')" id="btn-${client.id}">${client.paused ? 'Start' : 'Pause'}</button>
      </td>
      <td id="time-${client.id}" style="background-color: ${client.paused ? '' : '#d4edda'}">${formatTime(remaining)}</td>
      <td><button onclick="addHours('${client.id}')" style="margin-top:4px;">Add&nbsp;Time</button></td>
      <td>${client.buyDate}</td>
      <td><button class="delete" onclick="deleteClient('${client.id}')">Delete</button></td>
    `
    tbody.appendChild(row)
  })
}

async function toggleTimer(id) {
  const client = clients.find(c => c.id === id)
  if (!client) return

  const password = prompt(`Enter password to ${client.paused ? 'start' : 'pause'} the timer:`)
  if (!password) return

  const res = await fetch(`${BACKEND_URL}/check-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  })

  const result = await res.json()
  if (!result.valid) {
    alert('Incorrect password. Action canceled.')
    return
  }

  if (client.paused) {
    client.startTimestamp = new Date().toISOString()
    client.paused = false
  } else {
    const start = new Date(client.startTimestamp).getTime()
    const now = Date.now()
    const extraElapsed = Math.floor((now - start) / 1000)
    client.elapsedSeconds += extraElapsed
    client.startTimestamp = null
    client.paused = true
  }

  renderTable()
  await saveClients(password, `${client.paused ? 'Paused' : 'Started'} timer for ${client.name}`)
}

async function deleteClient(id) {
  const password = prompt('Enter password to delete client:')
  if (!password) return
  if (!(await isValidPassword(password))) return

  const confirmed = confirm('Are you sure you want to delete this client?')
  if (!confirmed) return

  const client = clients.find(c => c.id === id)
  
  clients = clients.filter(c => c.id !== id)
  renderTable()
  await saveClients(password, `deleted client ${client.name}`)
}

async function saveClients(passwordOverride = null, actionDesc = 'saved client list') {
  const password = passwordOverride || prompt('Enter password to save changes:')
  if (!password) return
  if (!(await isValidPassword(password))) return

  try {
    const cleanedClients = clients.filter(c => c.id && c.name && c.totalSeconds > 0)
    await fetch(`${BACKEND_URL}/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clients: cleanedClients, password, description: actionDesc })
    })
    dirty = false
  } catch (err) {
    console.error('Failed to save clients', err)
  }
}

async function isValidPassword(password) {
  const res = await fetch(`${BACKEND_URL}/check-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  })
  const result = await res.json()
  if (!result.valid) {
    alert('Incorrect password.')
    return false
  }
  return true
}

function addHours(id) {
  const client = clients.find(c => c.id === id)
  if (!client) return

  const hoursInput = prompt(`How many hours to add to ${client.name}?`, '0')
  const minutesInput = prompt(`How many minutes to add to ${client.name}?`, '0')

  const hours = parseInt(hoursInput, 10) || 0
  const minutes = parseInt(minutesInput, 10) || 0

  if (hours <= 0 && minutes <= 0) {
    alert('Please enter a valid number of hours or minutes.')
    return
  }

  const addedSeconds = (hours * 3600) + (minutes * 60)
  client.totalSeconds += addedSeconds

  renderTable()
  saveClients(null, `added ${hours} hours and ${minutes} minutes to ${client.name}`)
}

document.getElementById('addClientForm').addEventListener('submit', async (e) => {
  e.preventDefault()

  const id = crypto.randomUUID()
  const name = document.getElementById('clientName').value.trim()
  const phone = document.getElementById('clientPhone').value.trim()
  const role = document.getElementById('clientRole').value
  const hours = parseInt(document.getElementById('hours').value, 10)
  const seconds = hours * 3600
  const today = new Date().toISOString().slice(0, 10)

  if (!id || !name || !phone || isNaN(hours) || hours <= 0) {
    alert('Please fill in all fields correctly.')
    return
  }

  const password = prompt('Enter password to add client:')
  if (!password || !(await isValidPassword(password))) return

  const newClient = {
    id,
    name,
    phone,
    role,
    buyDate: today,
    totalSeconds: seconds,
    elapsedSeconds: 0,
    startTimestamp: null,
    paused: true
  }

  clients.push(newClient)
  renderTable()
  await saveClients(password, `added client ${name}`)
  document.getElementById('addClientForm').reset()
})

function updateDisplayedTimes() {
  clients.forEach(client => {
    const remaining = getRemainingSeconds(client)
    const timeElement = document.getElementById(`time-${client.id}`)
    const rowElement = document.getElementById(`row-${client.id}`)

    if (timeElement) timeElement.textContent = formatTime(remaining)
    if (rowElement)
      rowElement.style.backgroundColor = remaining <= 600 && remaining > 0 ? '#ffcccc' : ''

    if (remaining <= 0 && !client.paused && client.totalSeconds > 0) {
      // Add final elapsed time before pausing
      const start = new Date(client.startTimestamp).getTime()
      const now = Date.now()
      const extraElapsed = Math.floor((now - start) / 1000)
      client.elapsedSeconds += extraElapsed

      client.paused = true
      client.startTimestamp = null
      renderTable()
      //saveClients(null, `Auto-paused ${client.name} (time expired)`, true)
      logAutoPause(client.id, client.name)
      alert(`Client ${client.name} has finished their time.`)
    }
  })
}

let currentSort = { key: null, asc: true }

function sortTable(key) {
  if (currentSort.key === key) currentSort.asc = !currentSort.asc
  else currentSort = { key, asc: true }

  clients.sort((a, b) => {
    let valA, valB

    switch (key) {
      case 'role': valA = a.role; valB = b.role; break
      case 'name': valA = a.name; valB = b.name; break
      case 'phone': valA = a.phone; valB = b.phone; break
      case 'buyDate': valA = a.buyDate; valB = b.buyDate; break
      case 'remaining': valA = getRemainingSeconds(a); valB = getRemainingSeconds(b); break
      default: return 0
    }

    if (typeof valA === 'string') {
      valA = valA.toLowerCase()
      valB = valB.toLowerCase()
    }

    return valA < valB ? (currentSort.asc ? -1 : 1) : valA > valB ? (currentSort.asc ? 1 : -1) : 0
  })

  renderTable()
}

async function logAutoPause(clientId, clientName) {
  try {
    await fetch(`${BACKEND_URL}/log-auto-pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, clientName })
    })
  } catch (err) {
    console.error('Failed to log auto-pause:', err)
  }
}

setInterval(updateDisplayedTimes, 1000)

setInterval(() => {
  if (!dirty) fetchClients().catch(() => {})
}, 30000)

fetchClients()