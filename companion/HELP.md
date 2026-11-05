# Prompt Face

Controls a Prompt Face over its command port.

Set the face computer address and port 8772. A token is only needed when Prompt Face has `command.token` set.

## Presets

Mute tells Prompt Face to set its mute flag. Prompt Face does not silence the microphone. It paints the muted face and sends `muted=on` or `muted=off` to OBS, where a macro can mute the audio source. The key is green while that flag is off and red while it is on. The words on the key are `Mute off` and `Mute on`. Gray means the connection is down.

Prompt shows the face that is on screen. State images, set on the connection, replace the button picture for live, talking, emote, and muted. Leave a path empty and that state keeps the text.

Hold emote shows the text in the button action while the key is held, then clears it on release. Edit that text field for each face.

## Variables

`line` is the face text. `muted`, `mouth`, `hearing`, `mode`, `expression`, and `connected` follow the command port.
