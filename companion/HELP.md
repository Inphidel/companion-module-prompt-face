# Prompt Face

Controls a Prompt Face over its command port.

Set the face computer address and port 8772. A token is only needed when Prompt Face has `command.token` set.

## Presets

Mute tells Prompt Face to set its mute flag. Prompt Face does not silence the microphone. It paints the muted face and sends `muted=on` or `muted=off` to OBS, where a macro can mute the audio source. The key is green while that flag is off and red while it is on. The words on the key are `Mute off` and `Mute on`. Gray means the connection is down.

Prompt shows the face that is on screen. State images, set on the connection, replace the button picture for live, talking, emote, and muted. Leave a path empty and that state keeps the text.

Hold emote and Toggle emote look the same. Type the face in Face text. That text is the title on the key. Hold shows it while the key is down, then clears it on release. Toggle keeps it until you press the key again. The key is amber while that face is on screen. Title font size is on the Emote title feedback. A long title stays on one line and the rest is cut off. Untick Show the face text as the key title if you want different words in Button text.

Prompt shows the live face on one line. Font size is on the Show the prompt feedback. A long face is cut off instead of wrapping.

Hat A, Hat B, Hat C, Hat D, and Hat Off choose the separate hat picture. The key turns blue while that slot is in use. The pictures are configured on the Prompt expression page.

## Variables

`line` is the face text. `muted`, `mouth`, `hearing`, `mode`, `expression`, `hat`, and `connected` follow the command port.
