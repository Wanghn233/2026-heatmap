import { Solar } from 'lunar-javascript';
import './style.css'
const app = document.querySelector('#app')

// Helper to format date (Local Time to avoid UTC shift bug)
const formatDate = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Lunar Helper
const getLunarStr = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  const solar = Solar.fromYmd(y, m, d)
  const lunar = solar.getLunar()
  return `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`
}

// --- Data & State ---
// ... (rest of imports/state)

// Generate 2026 dates
const startDate = new Date('2026-01-01T00:00:00')
const endDate = new Date('2026-12-31T00:00:00')
const days = []

let currentDate = new Date(startDate)
while (currentDate <= endDate) {
  days.push(new Date(currentDate))
  currentDate.setDate(currentDate.getDate() + 1)
}

// Group into chunks of 10
const CHUNK_SIZE = 10
const chunks = []
for (let i = 0; i < days.length; i += CHUNK_SIZE) {
  chunks.push(days.slice(i, i + CHUNK_SIZE))
}

const weekdayMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

// Render Header
const header = `
  <header>
    <img src="/logo.svg" alt="App Logo" class="app-logo" />
    <h1>2026 Heatmap</h1>
    <div class="subtitle">一年只是36个10天而已</div>
  </header>
`

// Holidays Map (2026) - Comprehensive
const holidays = {
  // 元旦 (Jan 1-3)
  '2026-01-01': '元旦', '2026-01-02': '元旦', '2026-01-03': '元旦',
  // 春节 (Feb 15-23)
  '2026-02-15': '春节', '2026-02-16': '春节', '2026-02-17': '春节', '2026-02-18': '春节',
  '2026-02-19': '春节', '2026-02-20': '春节', '2026-02-21': '春节', '2026-02-22': '春节', '2026-02-23': '春节',
  // 清明 (Apr 4-6)
  '2026-04-04': '清明节', '2026-04-05': '清明节', '2026-04-06': '清明节',
  // 劳动节 (May 1-5)
  '2026-05-01': '劳动节', '2026-05-02': '劳动节', '2026-05-03': '劳动节', '2026-05-04': '劳动节', '2026-05-05': '劳动节',
  // 端午 (Jun 19-21)
  '2026-06-19': '端午节', '2026-06-20': '端午节', '2026-06-21': '端午节',
  // 中秋 (Sep 25-27)
  '2026-09-25': '中秋节', '2026-09-26': '中秋节', '2026-09-27': '中秋节',
  // 国庆 (Oct 1-7)
  '2026-10-01': '国庆节', '2026-10-02': '国庆节', '2026-10-03': '国庆节', '2026-10-04': '国庆节',
  '2026-10-05': '国庆节', '2026-10-06': '国庆节', '2026-10-07': '国庆节'
}

// Make-up Workdays (Shift days)
// These are weekends that are worked
const makeupWorkdays = [
  '2026-01-04', // Sun
  '2026-02-14', // Sat
  '2026-02-28', // Sat
  '2026-05-09', // Sat
  '2026-09-20', // Sun
  '2026-10-10'  // Sat
]

// Render Grid
const renderRow = (chunk, index) => {
  const cells = chunk.map(date => {
    // Default level is 0. Data will be filled by loadAllEvents() later.
    let level = 0

    const dateStr = formatDate(date)
    const holidayName = holidays[dateStr]
    const isMakeup = makeupWorkdays.includes(dateStr)

    // Check for weekend (0 is Sunday, 6 is Saturday)
    const dayOfWeek = date.getDay()
    const weekdayStr = weekdayMap[dayOfWeek]
    // It is a display weekend ONLY if it is Sat/Sun AND NOT a makeup workday
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6) && !isMakeup

    // Check for Today
    const now = new Date()
    const todayStr = formatDate(now)
    const isToday = dateStr === todayStr

    // If it's a holiday, add data attribute
    const holidayAttr = holidayName ? `data-holiday="${holidayName}"` : ''
    // Weekend attribute
    const weekendAttr = isWeekend ? 'data-weekend="true"' : ''
    // Makeup attribute (for tooltip)
    const makeupAttr = isMakeup ? 'data-makeup="true"' : ''
    // Today attribute
    const todayAttr = isToday ? 'data-today="true"' : ''

    return `
      <div 
        class="day-cell" 
        data-date="${dateStr}" 
        data-weekday="${weekdayStr}"
        data-level="${level}"
        ${holidayAttr}
        ${weekendAttr}
        ${makeupAttr}
        ${todayAttr}
      ></div>
    `
  }).join('')

  // Pad the last row if needed to keep alignment (optional, but CSS flex handles it fine)
  // Let's just render what we have.

  return `
    <div class="decade-row">
      <div class="row-label">#${index + 1}</div>
      ${cells}
    </div>
  `
}

// Render Header Row (1-10)
const numbers = Array.from({ length: 10 }, (_, i) => i + 1)
const headerRow = `
  <div class="header-row">
    <div class="header-label"></div> <!-- Spacer for row labels -->
    ${numbers.map(n => `<div class="col-num">${n}</div>`).join('')}
  </div>
`

const gridContent = chunks.map((chunk, index) => renderRow(chunk, index)).join('')

const heatmap = `
  <div class="heatmap-container">
    ${headerRow}
    ${gridContent}
  </div>
`

// Render Legend
const legend = `
  <div class="legend">
    <span>Less</span>
    <div class="legend-item" style="background: var(--level-0)"></div>
    <div class="legend-item" style="background: var(--level-1)"></div>
    <div class="legend-item" style="background: var(--level-2)"></div>
    <div class="legend-item" style="background: var(--level-3)"></div>
    <div class="legend-item" style="background: var(--level-4)"></div>
    <span>More</span>
    <span style="margin-left: 12px; font-size: 10px; color: var(--holiday-color);">■ Holiday</span>
    <span style="margin-left: 8px; font-size: 10px; color: var(--weekend-color);">■ Weekend</span>
  </div>
`

// Render Main Content
// Target the heatmap section specifically
const heatmapSection = document.querySelector('#heatmap-section')

heatmapSection.innerHTML = `
  ${header}
  <div id="content-area">
    ${heatmap}
    ${legend}
  </div>
`

// --- Tooltip Logic ---
const tooltip = document.createElement('div')
// (Keep tooltip logic as is)
tooltip.id = 'tooltip'
document.body.appendChild(tooltip)

const heatmapEl = document.querySelector('.heatmap-container')

// Use event delegation for better performance
heatmapEl.addEventListener('mouseover', (e) => {
  if (e.target.classList.contains('day-cell')) {
    const date = e.target.getAttribute('data-date')
    const weekday = e.target.getAttribute('data-weekday') // Read weekday
    const level = e.target.getAttribute('data-level')
    const holiday = e.target.getAttribute('data-holiday')
    const makeup = e.target.getAttribute('data-makeup')

    // Build Tooltip Content
    let text = `<span style="font-weight:600">${date} ${weekday}</span>`
    const lunar = getLunarStr(date)

    // Line 2: Lunar + Holiday
    text += `<br><span style="font-size:0.8em; opacity:0.7; color: var(--text-muted)">${lunar}`
    if (holiday) {
      text += ` <strong style="color: #fbbf24; margin-left:4px">🎉 ${holiday}</strong>`
    }
    text += `</span>`

    if (makeup) {
      // Put makeup on first line or end? Let's keep separate or append to line 1.
      // Previous code appended to text, likely line 1. Let's append to line 1 for consistency or line 2?
      // Re-reading previous logic: makeup was appended before lunar.
      // Let's modify:
    }

    // Refined logic:
    // Line 1: Date Weekday [Makeup]
    // Line 2: Lunar [Holiday]

    let line1 = `<span style="font-weight:600">${date} ${weekday}</span>`
    if (makeup) line1 += ` <span style="color: #ef4444; font-weight:bold;">(班)</span>`

    let line2 = `<span style="font-size:0.8em; opacity:0.7; color: var(--text-muted)">${lunar}`
    if (holiday) line2 += ` <strong style="color: #fbbf24; margin-left:4px; opacity:1">🎉 ${holiday}</strong>`
    line2 += `</span>`

    tooltip.innerHTML = line1 + "<br>" + line2
    tooltip.style.opacity = '1'

    // Position slightly above the element
    const rect = e.target.getBoundingClientRect()
    // Center horizontally on the cell, sit above it
    tooltip.style.left = `${rect.left + rect.width / 2}px`
    tooltip.style.top = `${rect.top}px`
  }
})

heatmapEl.addEventListener('mouseout', (e) => {
  if (e.target.classList.contains('day-cell')) {
    tooltip.style.opacity = '0'
  }
})

// Data Store
let eventsData = {}

// API Functions
const API_URL = '/api/events'
// (Functions moved to after Auth logic)

// --- Auth Logic ---
const authModal = document.getElementById('auth-modal')
const authInput = document.getElementById('auth-input')
const authBtn = document.getElementById('auth-btn')


let authToken = localStorage.getItem('year_app_token') || ''

const initApp = () => {
  if (authToken) {
    // We have a token, try to load data
    loadAllEvents()
  } else {
    // No token, show lock screen
    authModal.classList.remove('hidden')
  }
}

const handleLogin = () => {
  const pwd = authInput.value.trim()
  if (!pwd) return

  // Save as token (Simple logic for now, in real app, maybe exchange for JWT)
  authToken = pwd
  localStorage.setItem('year_app_token', authToken)

  // Unlock UI
  authModal.classList.add('hidden')

  // Load Data
  loadAllEvents()
}

// Updated API Functions with Auth
const loadAllEvents = async () => {
  // Creative Loading: Hide Heatmap, Animate Logo & Title
  const headerEl = document.querySelector('header')
  const dashboard = document.querySelector('#content-area')

  if (headerEl) headerEl.classList.add('loading')
  if (dashboard) dashboard.classList.add('hidden-loading')

  // Artificial delay to show off animation (optional, but good for UX feel if API is too fast)
  // await new Promise(r => setTimeout(r, 800)) 

  try {
    console.log('Fetching data...')
    const res = await fetch(API_URL, {
      headers: {
        'Authorization': `Bearer ${authToken}` // Send token
      }
    })

    if (res.status === 401 || res.status === 403) {
      // Token invalid
      console.warn('Auth failed')
      localStorage.removeItem('year_app_token')
      authToken = ''
      authModal.classList.remove('hidden')
      authInput.value = ''
      authInput.placeholder = 'Wrong password, try again'
      return
    }

    if (res.ok) {
      const cloudData = await res.json()
      eventsData = cloudData
      Object.keys(eventsData).forEach(date => {
        updateCellHeatmap(date)
      })
      console.log('Data loaded')
    }
  } catch (err) {
    console.warn('Failed to fetch events:', err)
  } finally {
    // Stop Loading
    if (headerEl) headerEl.classList.remove('loading')
    if (dashboard) dashboard.classList.remove('hidden-loading')
  }
}

const saveEvents = async (dateStr) => {
  const events = eventsData[dateStr] || []
  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ date: dateStr, events })
    })
  } catch (err) {
    console.error('Save failed:', err)
  }
}

// DOM Elements (Panel)
const panelOverlay = document.getElementById('panel-overlay')
const eventPanel = document.getElementById('event-panel')
const panelDateTitle = document.getElementById('panel-date')

const todoListEl = document.getElementById('todo-list')
const doneListEl = document.getElementById('done-list')
const giveupListEl = document.getElementById('giveup-list')

const eventInput = document.getElementById('event-input')
const addTodoBtn = document.getElementById('add-todo-btn')
const addDoneBtn = document.getElementById('add-done-btn')
const closeBtn = document.getElementById('close-btn')
const eventListContainer = document.getElementById('event-list-container')

// Listeners
authBtn.addEventListener('click', handleLogin)
authInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleLogin()
})

// Start
initApp()

let currentSelectedDate = null

// Functions
const openPanel = (dateStr) => {
  currentSelectedDate = dateStr
  renderEventsList()

  // Calculate meta info
  const dateObj = new Date(dateStr + 'T00:00:00')
  const dayIndex = dateObj.getDay()
  const weekday = weekdayMap[dayIndex]
  const holiday = holidays[dateStr]
  const isMakeup = makeupWorkdays.includes(dateStr)
  const currentEmoji = getEmoji(dateStr)
  const lunar = getLunarStr(dateStr)

  let line1 = `<span style="margin-right:8px">${dateStr}</span><span style="font-size:0.85em; opacity:0.8">${weekday}</span>`

  let line2 = `<span>${lunar}</span>`

  if (holiday) {
    line2 += `<span style="font-size:0.9em; color:var(--holiday-color); margin-left:6px">🎉 ${holiday}</span>`
  } else if (isMakeup) {
    line2 += `<span style="font-size:0.9em; color:#ef4444; margin-left:6px">班</span>`
  }

  const headerHtml = `
    <div style="display:flex; align-items:center">
      <form action="javascript:void(0);" autocomplete="off" style="margin:0;">
        <input type="search" id="panel-emoji-input" maxlength="2" value="${currentEmoji}" placeholder="☺" autocomplete="off" name="search_emoji" spellcheck="false">
      </form>
      <div style="display:flex; flex-direction:column; justify-content:center; align-items:flex-start; margin-left: 12px;">
        <div>${line1}</div>
        <div style="font-size:0.75em; color:var(--text-muted); line-height:1.2; margin-top:4px; display:flex; align-items:center">
          ${line2}
        </div>
      </div>
    </div>
  `

  panelDateTitle.innerHTML = headerHtml

  // Bind Emoji Input
  const emojiInput = document.getElementById('panel-emoji-input')

  // Real-time update
  emojiInput.addEventListener('input', (e) => {
    const val = e.target.value
    setEmoji(dateStr, val)
    updateCellHeatmap(dateStr)
  })

  // Save on blur/enter
  emojiInput.addEventListener('change', () => {
    saveEvents(dateStr)
  })

  // Mobile Fix: Hide tooltip immediately when panel opens
  const tooltip = document.getElementById('tooltip')
  if (tooltip) tooltip.style.opacity = '0'

  panelOverlay.classList.remove('hidden')
  eventPanel.classList.remove('hidden')

  // Focus input on desktop
  if (window.innerWidth > 640) {
    setTimeout(() => eventInput.focus(), 100)
  }

  // Push history state so Back button closes panel
  window.history.pushState({ panel: 'open' }, '')
}

const hidePanelUI = () => {
  panelOverlay.classList.add('hidden')
  eventPanel.classList.add('hidden')
  // Don't clear currentSelectedDate immediately to avoid render glitches during transition
}

const closePanel = () => {
  // Go back in history -> triggers popstate -> calls hidePanelUI
  window.history.back()
}

// Handle Back Button
window.addEventListener('popstate', () => {
  if (!eventPanel.classList.contains('hidden')) {
    hidePanelUI()
  }
})

// Emoji Helpers
const getEmoji = (date) => {
  const events = eventsData[date] || []
  const meta = events.find(e => e.status === 'meta')
  return meta ? meta.text : ''
}

const setEmoji = (date, char) => {
  if (!eventsData[date]) eventsData[date] = []

  // Remove existing meta
  const idx = eventsData[date].findIndex(e => e.status === 'meta')
  if (idx !== -1) eventsData[date].splice(idx, 1)

  // Add new if char exists
  if (char) {
    eventsData[date].push({
      id: 'meta-emoji', // Fixed ID so we don't spam
      text: char,
      status: 'meta'
    })
  }
}

const renderEventsList = () => {
  if (!currentSelectedDate) return

  const events = eventsData[currentSelectedDate] || []

  // Clear lists
  todoListEl.innerHTML = ''
  doneListEl.innerHTML = ''
  giveupListEl.innerHTML = ''

  let todoCount = 0
  let doneCount = 0
  let giveupCount = 0

  events.forEach((evt, index) => { // idx for hard delete if needed, but we rely on ID for logic mainly
    // Skip Meta events (Emoji)
    if (evt.status === 'meta') return

    const item = document.createElement('div')
    item.className = `event-item ${evt.status}`
    // Show 'Recover' icon or empty checkbox for Giveup? Let's use same checkbox but styled differently in CSS
    item.innerHTML = `
      <div class="event-checkbox" data-id="${evt.id}" title="${evt.status === 'giveup' ? 'Restore to Todo' : 'Toggle Done'}"></div>
      <span class="event-text">${evt.text}</span>
      <span class="delete-event" data-idx="${idx}" title="${evt.status === 'giveup' ? 'Permanently Delete' : 'Give Up'}">✕</span>
    `

    if (evt.status === 'done') {
      doneListEl.appendChild(item)
      doneCount++
    } else if (evt.status === 'giveup') {
      giveupListEl.appendChild(item)
      giveupCount++
    } else {
      todoListEl.appendChild(item)
      todoCount++
    }
  })

  // Toggle Section Visibility
  todoListEl.parentElement.style.display = todoCount > 0 ? 'block' : 'none'
  doneListEl.parentElement.style.display = doneCount > 0 ? 'block' : 'none'
  giveupListEl.parentElement.style.display = giveupCount > 0 ? 'block' : 'none'

  // Manage Empty State
  const existingMsg = eventListContainer.querySelector('.empty-state')
  if (existingMsg) existingMsg.remove()

  if (todoCount === 0 && doneCount === 0 && giveupCount === 0) {
    const msg = document.createElement('div')
    msg.className = 'empty-state'
    msg.textContent = '今日无事.'
    eventListContainer.appendChild(msg)
  }
}

const updateCellHeatmap = (dateStr) => {
  const events = eventsData[dateStr] || []
  // Only count DONE tasks for heat level
  const doneCount = events.filter(e => e.status === 'done').length

  let level = 0
  if (doneCount > 0) level = 1
  if (doneCount >= 2) level = 2
  if (doneCount >= 4) level = 3
  if (doneCount >= 6) level = 4

  const cell = document.querySelector(`.day-cell[data-date="${dateStr}"]`)
  if (cell) {
    cell.setAttribute('data-level', level)

    // Render Emoji
    const emoji = getEmoji(dateStr)
    cell.innerHTML = emoji ? `<div class="cell-emoji">${emoji}</div>` : ''
  }
}

const addEvent = (status = 'todo') => { // Accept status
  const text = eventInput.value.trim()
  if (!text || !currentSelectedDate) return

  if (!eventsData[currentSelectedDate]) {
    eventsData[currentSelectedDate] = []
  }

  eventsData[currentSelectedDate].push({
    text,
    id: Date.now(),
    status: status // Use passed status
  })

  eventInput.value = ''
  renderEventsList()
  updateCellHeatmap(currentSelectedDate)
  saveEvents(currentSelectedDate) // Cloud Save
}

const deleteEvent = (idx) => {
  if (!currentSelectedDate || !eventsData[currentSelectedDate]) return

  const evt = eventsData[currentSelectedDate][idx]

  if (evt.status === 'giveup') {
    // Hard Delete
    eventsData[currentSelectedDate].splice(idx, 1)
  } else {
    // Soft Delete -> Give Up
    evt.status = 'giveup'
  }

  renderEventsList()
  updateCellHeatmap(currentSelectedDate)
  saveEvents(currentSelectedDate) // Cloud Save
}

// Toggle: Todo <-> Done. 
// Giveup -> Todo (Restore)
const toggleEventStatus = (id) => {
  if (!currentSelectedDate || !eventsData[currentSelectedDate]) return

  const event = eventsData[currentSelectedDate].find(e => e.id == id)
  if (event) {
    if (event.status === 'giveup') {
      event.status = 'todo' // Restore
    } else {
      event.status = event.status === 'done' ? 'todo' : 'done'
    }
    renderEventsList()
    updateCellHeatmap(currentSelectedDate)
    saveEvents(currentSelectedDate) // Cloud Save
  }
}

// Listeners
heatmapEl.addEventListener('click', (e) => {
  const cell = e.target.closest('.day-cell')
  if (cell) {
    const date = cell.getAttribute('data-date')
    openPanel(date)
  }
})

closeBtn.addEventListener('click', closePanel)
panelOverlay.addEventListener('click', closePanel)

// Bind Dual Buttons
addTodoBtn.addEventListener('click', () => addEvent('todo'))
addDoneBtn.addEventListener('click', () => addEvent('done'))

eventInput.addEventListener('keydown', (e) => {
  // Enter = Todo, Ctrl+Enter = Done
  if (e.key === 'Enter') {
    if (e.metaKey || e.ctrlKey) {
      addEvent('done')
    } else {
      addEvent('todo')
    }
  }
})

// Delegation for Delete and Toggle
const handleListClick = (e) => {
  // Handle Delete / Give Up Button
  if (e.target.classList.contains('delete-event')) {
    const idx = parseInt(e.target.getAttribute('data-idx'))
    deleteEvent(idx)
    return
  }

  // Handle Checkbox Toggle
  if (e.target.classList.contains('event-checkbox')) {
    const id = e.target.getAttribute('data-id')
    toggleEventStatus(id)
    return
  }

  // Optional: Click text to toggle too?
  /*
  const item = e.target.closest('.event-item')
  if (item && !e.target.classList.contains('delete-event')) {
      const checkbox = item.querySelector('.event-checkbox')
      toggleEventStatus(checkbox.getAttribute('data-id'))
  }
  */
}

todoListEl.addEventListener('click', handleListClick)
doneListEl.addEventListener('click', handleListClick)
giveupListEl.addEventListener('click', handleListClick)

// Close on Esc
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePanel()
})

// --- Global UX Enhancements ---
// Disable Context Menu (Right-Click) except on inputs
document.addEventListener('contextmenu', (e) => {
  // Allow if target is input or textarea, or contenteditable
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
    return true
  }
  e.preventDefault()
  return false
}, { passive: false })

// Disable Pinch Zoom (iOS Safari)
document.addEventListener('gesturestart', (e) => {
  e.preventDefault()
})

// --- Fix: Prevent Browser Scroll Restoration ---
// Browsers often restore scroll position on reload (even pull-to-refresh).
// This forces the page to start at the top every time.
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
// Ensure we are at top
window.scrollTo(0, 0);
