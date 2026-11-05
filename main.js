const fs = require('fs')
const { InstanceBase, Regex, runEntrypoint, InstanceStatus, TCPHelper, combineRgb } = require('@companion-module/base')

const EXPRESSION = new Set(['closed', 'open', 'wide'])

function parseReply(line) {
	const parsed = { ok: line.startsWith('ok '), error: line.startsWith('err ') ? line.slice(4) : '' }
	let body = line
	const cut = body.indexOf(' line=')
	if (cut >= 0) {
		parsed.line = body.slice(cut + ' line='.length)
		body = body.slice(0, cut)
	}
	for (const part of body.split(' ')) {
		const mark = part.indexOf('=')
		if (mark > 0) parsed[part.slice(0, mark)] = part.slice(mark + 1)
	}
	return parsed
}

class PromptFace extends InstanceBase {
	constructor(internal) {
		super(internal)
		this.socket = undefined
		this.poll = undefined
		this.buffer = ''
		this.connected = false
		this.images = {}
		this.emoteText = new Map()
		this.state = {
			mouth: 'jaw',
			hearing: 'no',
			muted: 'off',
			mode: 'live',
			expression: 'closed',
			line: '',
			connected: 'no',
		}
	}

	async init(config) {
		this.config = config
		this.updateActions()
		this.updateFeedbacks()
		this.updateVariableDefinitions()
		this.updatePresets()
		this.openSocket()
	}

	async destroy() {
		if (this.poll) clearInterval(this.poll)
		this.poll = undefined
		this.socket?.destroy()
		this.socket = undefined
	}

	async configUpdated(config) {
		this.config = config
		this.images = {}
		await this.destroy()
		this.openSocket()
	}

	getConfigFields() {
		return [
			{
				type: 'textinput',
				id: 'host',
				label: 'Face computer',
				width: 8,
				default: '',
			},
			{
				type: 'textinput',
				id: 'port',
				label: 'Command port',
				width: 4,
				default: '8772',
				regex: Regex.PORT,
			},
			{
				type: 'textinput',
				id: 'token',
				label: 'Token',
				width: 8,
				default: '',
			},
			{
				type: 'static-text',
				id: 'image-note',
				label: 'State images',
				width: 12,
				value: 'Optional PNG files on this computer. Leave a path empty to keep the button text.',
			},
			{ type: 'textinput', id: 'image_live', label: 'Live image', width: 12, default: '' },
			{ type: 'textinput', id: 'image_talk', label: 'Talking image', width: 12, default: '' },
			{ type: 'textinput', id: 'image_emote', label: 'Emote image', width: 12, default: '' },
			{ type: 'textinput', id: 'image_muted', label: 'Muted image', width: 12, default: '' },
		]
	}

	openSocket() {
		const host = (this.config.host || '').trim()
		const port = Number(this.config.port) || 8772
		if (!host) {
			this.connected = false
			this.publish({ connected: 'no' })
			this.updateStatus(InstanceStatus.BadConfig, 'Set the face computer address')
			return
		}
		this.updateStatus(InstanceStatus.Connecting)
		this.buffer = ''
		this.socket = new TCPHelper(host, port)
		this.socket.on('status_change', (status, message) => {
			this.connected = status === InstanceStatus.Ok
			this.updateStatus(status, message)
			this.publish({ connected: this.connected ? 'yes' : 'no' })
			if (this.connected) this.send('status')
		})
		this.socket.on('error', (error) => {
			this.log('error', `command port: ${error.message || error}`)
		})
		this.socket.on('data', (data) => this.onData(data))
		this.poll = setInterval(() => {
			if (this.connected) this.send('status')
		}, 400)
	}

	send(line) {
		if (!this.socket || !this.connected) return
		const token = (this.config.token || '').trim()
		const payload = token ? `${token} ${line}` : line
		this.socket.send(`${payload}\n`)
	}

	onData(data) {
		this.buffer += data.toString('utf8')
		let end = this.buffer.indexOf('\n')
		while (end >= 0) {
			const line = this.buffer.slice(0, end).trim()
			this.buffer = this.buffer.slice(end + 1)
			if (line) this.onLine(line)
			end = this.buffer.indexOf('\n')
		}
	}

	onLine(line) {
		const parsed = parseReply(line)
		if (parsed.error) {
			this.log('warn', parsed.error)
			return
		}
		if (!parsed.ok) return
		const next = {}
		for (const key of ['mouth', 'hearing', 'muted', 'mode', 'expression', 'line']) {
			if (parsed[key] !== undefined) next[key] = parsed[key]
		}
		if (next.expression && !EXPRESSION.has(next.expression)) next.expression = 'closed'
		this.publish(next)
	}

	publish(values) {
		this.state = { ...this.state, ...values }
		this.setVariableValues(this.state)
		this.checkFeedbacks()
	}

	imageKey() {
		if (this.state.muted === 'on') return 'muted'
		if (this.state.mode === 'emote') return 'emote'
		if (this.state.expression === 'open' || this.state.expression === 'wide') return 'talk'
		return 'live'
	}

	imageFor(key) {
		const path = (this.config[`image_${key}`] || '').trim()
		if (!path) return undefined
		try {
			const stat = fs.statSync(path)
			const cached = this.images[key]
			if (cached && cached.path === path && cached.mtime === stat.mtimeMs) return cached.png
			const png = fs.readFileSync(path).toString('base64')
			this.images[key] = { path, mtime: stat.mtimeMs, png }
			return png
		} catch {
			return undefined
		}
	}

	updateActions() {
		this.setActionDefinitions({
			mute: {
				name: 'Mute',
				options: [
					{
						type: 'dropdown',
						id: 'mode',
						label: 'Mute',
						default: 'toggle',
						choices: [
							{ id: 'toggle', label: 'Toggle' },
							{ id: 'on', label: 'Mute' },
							{ id: 'off', label: 'Unmute' },
						],
					},
				],
				callback: (action) => this.send(`mute ${action.options.mode || 'toggle'}`),
			},
			mouth: {
				name: 'Mouth source',
				options: [
					{
						type: 'dropdown',
						id: 'mode',
						label: 'Source',
						default: 'toggle',
						choices: [
							{ id: 'toggle', label: 'Toggle jaw and sound' },
							{ id: 'sound', label: 'Sound' },
							{ id: 'jaw', label: 'Jaw' },
						],
					},
				],
				callback: (action) => this.send(`mouth ${action.options.mode || 'toggle'}`),
			},
			emote: {
				name: 'Show emote',
				options: [
					{
						type: 'textinput',
						id: 'text',
						label: 'Face text',
						default: '',
						useVariables: true,
					},
				],
				callback: async (action, context) => {
					const text = await context.parseVariablesInString(action.options.text || '')
					if (text.trim()) this.send(`emote ${text}`)
				},
			},
			clear: {
				name: 'Clear emote',
				options: [],
				callback: () => this.send('clear'),
			},
			emote_toggle: {
				name: 'Toggle emote',
				description: 'Shows this face until the key is pressed again',
				options: [
					{
						type: 'textinput',
						id: 'text',
						label: 'Face text',
						default: '',
						useVariables: true,
					},
				],
				optionsToMonitorForSubscribe: ['text'],
				subscribe: (action) => {
					this.emoteText.set(action.controlId, action.options.text || '')
					this.checkFeedbacks('emote_toggle')
				},
				unsubscribe: (action) => {
					this.emoteText.delete(action.controlId)
					this.checkFeedbacks('emote_toggle')
				},
				callback: async (action, context) => {
					const text = await context.parseVariablesInString(action.options.text || '')
					if (!text.trim()) return
					this.emoteText.set(action.controlId, text)
					this.send(`emote toggle ${text}`)
				},
			},
		})
	}

	updateFeedbacks() {
		this.setFeedbackDefinitions({
			muted: {
				type: 'advanced',
				name: 'Mute state',
				description: 'Green while the face mute is off, red while it is on. The words come from the connection.',
				options: [],
				callback: () => {
					if (this.state.connected !== 'yes') {
						return {
							bgcolor: combineRgb(40, 42, 36),
							color: combineRgb(180, 180, 170),
							text: 'Mute',
						}
					}
					const on = this.state.muted === 'on'
					return {
						bgcolor: on ? combineRgb(140, 20, 20) : combineRgb(24, 120, 48),
						color: combineRgb(255, 255, 255),
						text: on ? 'Mute on' : 'Mute off',
					}
				},
			},
			emote_toggle: {
				type: 'advanced',
				name: 'Toggle emote',
				description: 'Highlights the key while this button’s face is on screen',
				options: [],
				callback: (feedback) => {
					const text = this.emoteText.get(feedback.controlId) || ''
					const on =
						this.state.connected === 'yes' &&
						!!text.trim() &&
						this.state.mode === 'emote' &&
						this.state.line === text
					if (this.state.connected !== 'yes') {
						return {
							bgcolor: combineRgb(40, 42, 36),
							color: combineRgb(180, 180, 170),
						}
					}
					return {
						bgcolor: on ? combineRgb(176, 122, 24) : combineRgb(20, 22, 16),
						color: combineRgb(255, 255, 255),
					}
				},
			},
			show_prompt: {
				type: 'advanced',
				name: 'Show the prompt',
				description: 'Puts the live face on the button, and the state image when one is set',
				options: [
					{
						type: 'checkbox',
						id: 'show_line',
						label: 'Show the live face text',
						default: true,
					},
					{
						type: 'checkbox',
						id: 'use_images',
						label: 'Use the state images',
						default: true,
					},
				],
				callback: (feedback) => {
					const style = {}
					if (feedback.options.show_line) style.text = this.state.line || ' '
					if (feedback.options.use_images) {
						const png = this.imageFor(this.imageKey())
						if (png) style.png64 = png
					}
					return style
				},
			},
		})
	}

	updateVariableDefinitions() {
		this.setVariableDefinitions([
			{ variableId: 'line', name: 'Face line' },
			{ variableId: 'muted', name: 'Face mute on or off' },
			{ variableId: 'mouth', name: 'Mouth source' },
			{ variableId: 'hearing', name: 'Capture open' },
			{ variableId: 'mode', name: 'live or emote' },
			{ variableId: 'expression', name: 'Mouth expression' },
			{ variableId: 'connected', name: 'Command port connected' },
		])
		this.setVariableValues(this.state)
	}

	updatePresets() {
		const face = {
			text: 'Prompt',
			size: '14',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(20, 22, 16),
			alignment: 'center:center',
		}
		this.setPresetDefinitions({
			mute: {
				type: 'button',
				category: 'Prompt',
				name: 'Mute',
				style: { ...face, text: 'Mute' },
				steps: [{ down: [{ actionId: 'mute', options: { mode: 'toggle' } }], up: [] }],
				feedbacks: [{ feedbackId: 'muted', options: {} }],
			},
			prompt: {
				type: 'button',
				category: 'Prompt',
				name: 'Prompt',
				style: { ...face, text: 'Prompt', size: '7' },
				steps: [{ down: [], up: [] }],
				feedbacks: [
					{
						feedbackId: 'show_prompt',
						options: { show_line: true, use_images: true },
					},
				],
			},
			hold: {
				type: 'button',
				category: 'Prompt',
				name: 'Hold emote',
				style: { ...face, text: 'Emote' },
				steps: [
					{
						down: [{ actionId: 'emote', options: { text: '' } }],
						up: [{ actionId: 'clear', options: {} }],
					},
				],
				feedbacks: [],
			},
			toggle: {
				type: 'button',
				category: 'Prompt',
				name: 'Toggle emote',
				style: { ...face, text: 'Emote' },
				steps: [{ down: [{ actionId: 'emote_toggle', options: { text: '' } }], up: [] }],
				feedbacks: [{ feedbackId: 'emote_toggle', options: {} }],
			},
		})
	}
}

runEntrypoint(PromptFace, [])
