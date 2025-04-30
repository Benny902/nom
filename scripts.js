const BACKEND_URL = 'https://nom-gaming-backend.onrender.com'

let clients = []

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
  tbody.innerHTML = ''

  clients.forEach(client => {
    const remaining = getRemainingSeconds(client)
    const row = document.createElement('tr')
    row.id = `row-${client.id}`
    row.innerHTML = `
      <td>${client.role}</td>
      <td>${client.name}</td>
      <td>${client.phone || ''}</td>
      <td style="background-color: ${client.paused ? '' : '#d4edda'}">
        <button onclick="toggleTimer('${client.id}')" id="btn-${client.id}">
          ${client.paused ? 'Start' : 'Pause'}
        </button>
      </td>  
      <td id="time-${client.id}" style="background-color: ${client.paused ? '' : '#d4edda'}">
        ${formatTime(remaining)}
      </td>   
      <td>  
        <button onclick="addHours('${client.id}')" style="margin-top: 4px;">
          Add Time
        </button>
      </td> 
      <td>${client.buyDate}</td>
      <td>
        <button class="delete" onclick="deleteClient('${client.id}')">Delete</button>
      </td>
    `
    tbody.appendChild(row)
  })
}

function toggleTimer(id) {
  const client = clients.find(c => c.id === id)
  if (!client) return

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
  saveClients()
}

async function deleteClient(id) {
  const password = prompt('Enter password to delete client:')
  if (!password) return

  const res = await fetch(`${BACKEND_URL}/check-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  })

  const result = await res.json()
  if (!result.valid) {
    alert('Incorrect password. Client not deleted.')
    return
  }

  const confirmed = confirm('Are you sure you want to delete this client?')
  if (!confirmed) return

  clients = clients.filter(c => c.id !== id)
  renderTable()
  saveClients()
}

async function saveClients() {
  try {
    const cleanedClients = clients.filter(c => c.id && c.name && c.totalSeconds > 0)
    await fetch(`${BACKEND_URL}/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clients: cleanedClients })
    })
  } catch (err) {
    console.error('Failed to save clients', err)
  }
}

function addHours(id) {
  const client = clients.find(c => c.id === id)
  if (!client) return

  const input = prompt(`Add how many hours to ${client.name}?`)
  const hours = parseInt(input, 10)
  if (isNaN(hours) || hours <= 0) return

  client.totalSeconds += hours * 3600
  renderTable()
  saveClients()
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
  if (!password) return

  const res = await fetch(`${BACKEND_URL}/check-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  })
  const result = await res.json()
  if (!result.valid) {
    alert('Incorrect password. Client not added.')
    return
  }

  const exists = clients.some(c => c.id === id)
  if (exists) {
    alert('Client with this ID already exists.')
    return
  }

  const newClient = {
    id,
    name,
    phone,
    role,
    buyDate: today,
    totalSeconds: seconds,
    elapsedSeconds: 0,
    startTimestamp: null,
    paused: true,
  }  

  clients.push(newClient)
  renderTable()
  await saveClients()
  document.getElementById('addClientForm').reset()
})

function updateDisplayedTimes() {
  clients.forEach(client => {
    const remaining = getRemainingSeconds(client)
    const timeElement = document.getElementById(`time-${client.id}`)
    const rowElement = document.getElementById(`row-${client.id}`)

    if (timeElement) {
      timeElement.textContent = formatTime(remaining)
    }

    if (rowElement) {
      if (remaining <= 600 && remaining > 0) {
        rowElement.style.backgroundColor = '#ffcccc'
      } else {
        rowElement.style.backgroundColor = ''
      }
    }

    if (remaining <= 0 && !client.paused) {
      toggleTimer(client.id)
      alert(`Client ${client.name} has finished their time.`)
    }
  })
}

setInterval(updateDisplayedTimes, 1000)
setInterval(() => fetchClients().catch(() => {}), 30000)
fetchClients()
