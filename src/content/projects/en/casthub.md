---
title: Cast Hub
year: 2026
kind: Linux system
category: systems
role: Sole designer & developer
stack: [Python, Fedora, KDE Plasma, QML, GStreamer]
summary: A branded Fedora system that doubles as an AirPlay and Miracast screen.
art: harbour
order: 4
links:
  - { label: GitHub, url: "https://github.com/WhyFenceCode/casthub" }
---
## The problem
I wanted one machine that works as a normal computer but can also act as a shared screen that anyone in the room can cast their laptop or phone to without signing in. I didn't want to use an off-the-shelf receiver, as it would add costs and I had hardware lying around.

## What we built
I built a custom Fedora system with a normal sign-in, a casting mode that needs no sign-in, and some basic desktop functions. It uses a custom Miracast receiver written in Python that handles the connection handshakes and passthrough. It's custom branded and fun to work on. Claude Code is a co-author on the project, as I just needed it late one night. It's still in progress: the receivers work, and the custom desktop is being built now.
