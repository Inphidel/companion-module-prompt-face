# Prompt Face for Companion

Stream Deck buttons for [Prompt Face](https://github.com/Inphidel/prompt-face). Companion talks to the command port on the computer that is running the face. The buttons are presets, so they replace a raw TCP action.

Mute silences the microphone Prompt Face and OBS are sharing. The Prompt button shows the live face text. Hold emote has a text field: the face shows while the key is down and clears when the key comes up.

## What you need

- Bitfocus Companion 3 on the Stream Deck computer
- Prompt Face running, with TCP port 8772 reachable
- Node.js 18 or newer, only for the install below

## Install

Clone this repository into a folder that will hold Companion modules. The development path is the parent of this folder, not this folder itself.

```bash
git clone https://github.com/Inphidel/companion-module-prompt-face.git
cd companion-module-prompt-face
npm install
```

In Companion, open the launcher, then the cog, then Advanced Settings. Set the developer module path to the parent folder. Restart Companion. Add a connection named Prompt Face and set:

- Face computer: the address of the machine running Prompt Face
- Command port: `8772`
- Token: leave empty unless Prompt Face has one

Drag the presets onto a page.

## State images

On the connection, each state can point at a PNG on the Stream Deck computer:

- Live image, when the camera face is showing and the mouth is closed
- Talking image, when the mouth is open or wide
- Emote image, while a custom face is holding
- Muted image, while the microphone is muted

The Prompt preset uses those pictures. An empty path leaves the face text on the key. The text is the whole line, and a long emote is cut off by the key.

## Commands the buttons send

```text
mute toggle
emote TEXT
clear
status
```

`status` is polled so the Prompt key can follow the face. The face text is the remainder of the line after `line=`.
