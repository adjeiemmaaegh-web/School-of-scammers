# FACTORY I/O – uploaded reference inventory and review notes

**Reviewed:** 8 November 2026. **Sources:** four supplied screenshots (PNG) and six supplied saved documentation pages (HTML). These are reference observations, not a functional test of the FACTORY I/O application.

## Screenshot observations

### image.png — Welcome / Documentation and Tutorials
Dark grey application welcome screen. Left rail titled **WELCOME**, containing Documentation and Tutorials (selected in red), New, Open, Scenes, and Update Checker; a Show this window at startup checkbox along bottom. Main section Documentation has tiles Getting Started (pushbuttons and emergency stop on a control panel), Manual (three industrial binders), Parts (equipment/cabinet graphic), Scenes (multi-branch conveyor), What’s New (newsletter). The Tutorials tiles show Allen-Bradley, Schneider, Siemens, CODESYS, Interface Boards, and Control I/O, each with a thumbnail and short explanatory label. Layout is icon/thumb-centric with grey text and red section headings.

### image(1).png — empty 3D warehouse scene and editor
Dark top menubar with FILE, EDIT, VIEW and play/pause/other tool icons; perspective/orbit view into a large mostly empty industrial hall with concrete floor slab lines, wall panels, overhead room lighting, an exit door and red fixtures. Right docked palette has category drop-down set to **All**, Search field, a 3-column scrolling grid of parts icons. Palette items visible include brown boxes, pallets, colored components, roller conveyors, straight/converging equipment, workstations, sensors, and other mechanical parts. Bottom-right orange warning reads **Low performance: 14 FPS**. The frame demonstrates the spatial scale of an editable factory and importance of rendering-performance control.

### image(2).png — close-up of parts palette
Right-side dark vertical palette with All category dropdown, Search input, scrollbar and three-column icon grid. Icons show three-color variants (cyan/green/grey) of square/flat and recessed parts, machine and chute/conveyor assemblies, roller conveyors labeled 2m, 4m, 6m, curved conveyors, worktables labeled 2m, 4m and 6m, turntable, belt sections, control/sensor-like components, a panel/door/frame, and electronic parts. Bottom-right warning reads **Low performance: 15 FPS**. Many icons do not have visible text labels; descriptive categories here are visual observations rather than verified exact item names.

### image(3).png — Open Scene / Scenes browser
Left rail titled **Open Scene**, with My Scenes and Scenes (selected in red). Main panel has instruction that scenes are inspired by common industrial applications, offer beginner to advanced challenges, and can be edited as a base for new scenes. A densely packed thumbnail grid with scene names and descriptions is arranged by name (Order by: Name ↑ at top right); 21 included scenes are enumerated below.

## The 21 included scenes
1. From A to B
2. From A to B (Set and Reset)
3. Filling Tank (Timers)
4. Queue of Items (Counters)
5. Assembler
6. Assembler (Analog)
7. Automated Warehouse
8. Buffer Station
9. Converge Station
10. Elevator (Basic)
11. Elevator (Advanced)
12. Level Control
13. Palletizer
14. Pick & Place (Basic)
15. Pick & Place XYZ
16. Production Line
17. Separating Station
18. Sorting by Height (Basic)
19. Sorting by Height (Advanced)
20. Sorting by Weight
21. Sorting Station

## Documentation coverage and verified facts

### Getting Started index.html
Guide introduces navigating cameras, creating/editing scenes, controlling with external technologies, and using the virtual factory with a PLC.

### 1. Navigating — navigating.html
**Orbit camera** is the default and intended for editing; passes through parts, rotates around user-defined white-dot point of interest set by double left-click, and this point sets height of newly placed parts (except common floor-placement parts). Controls: right mouse drag orbit, middle drag horizontal pan, wheel zoom, Backspace reset, WASD/arrows move. **Fly camera** freely moves in 3D, collides with parts but is not detected by sensors; double left-click points to cursor, right-drag rotates, wheel rises/lowers, both left+right buttons or W move forward, WASD/arrows move. **First Person camera** models a 1.8 m (~5.9 ft) person, collides with parts, is not detected by sensors by default; `camera.fp_detected = 1` makes it detectable; shares Fly-like movement and Space jumps. Orbit is construction camera; Fly and First Person are exploration/simulation cameras.

### 2. Opening a Scene — opening-a-scene.html
File > Open (Ctrl+O), select via left-click. FACTORY I/O includes 21 scenes in the Scenes tab. Open one and Save with a custom name to use as your own starting point.

### 3. Creating a Scene — creating-a-scene.html
Create new scene via File > New (Ctrl+N); choose Orbit camera; show Palette. Select Heavy Load Parts and drag a Roller Conveyor (2m); new part becomes selected with white bounding box. Drag selected part horizontally or press V and drag vertically. Set orbit point of interest using double-left-click near conveyor edge (affects placement height) and zoom wheel. In Sensors category drag a diffuse sensor to conveyor edge; right-click Duplicate (Left Alt) and move duplicate to other end. Rectangle-select all parts using left drag from scene background; Group via right click > Group (Ctrl+G), Ungroup with same shortcut, select member using Ctrl+left-click. Duplicate group (Left Alt) until three conveyor/sensor groups exist; red bounding boxes mean collisions/intersections and affected parts will be destroyed on entering Run mode. Drag Turntable from All, place in front; rotate conveyors with context Yaw +/- (Y); most parts 90-degree increments, sensors freely around local up axis; white arrows show conveyor travel direction. Place a pallet from Items category on first conveyor; File > Save (Ctrl+S), provide name and optional description.

### 4. Manually Controlling a Scene — manually-controlling-scene.html
Manual testing is recommended before PLC connections. Sensors and actuators each have at least one named/value tag. **Sensor Tags** and **Actuator Tags** may hold Boolean, Float or Integer values. Tag values can be **forced** to act as the controller; in Run mode (Play icon), show Actuator Tags button, click a tag to **dock** it, then force its value (tutorial example moves a pallet toward the left conveyor). View menu supports Dock All Tags and Clear Docked Tags.

### 5. Controlling with a PLC — controlling-with-a-plc.html
An **I/O Driver** is the built-in interface linking the simulation to a chosen external controller. Open File > Drivers (F4) or click current driver on status bar; select appropriate driver (tutorial uses **Siemens S7-1200/1500 Ethernet**). Open Configuration, set S7-1200 and the PLC Host/IP address; go Back (Esc), press Connect, and check for green connection indicator. Special **Factory I/O (...) simulation tags** convey running/paused status and simulation time scale (slow/fast) to controller. Map scene tags by drag-and-drop to desired PLC ports; undo mapping by dragging back to list. Run simulation and test PLC control logic. Other drivers require analogous configuration.

## Documentation information architecture visible in saved HTML
Top tabs: Welcome; Getting Started; Manual; Tutorials & Samples; Release Notes. Sidebar links identify (but do not include the content of) Manual sections: User Interface, Options, Navigation, Edit and Run, Tags, Failure Injection, Scenes, and additional sections elsewhere in the navigation. Saved pages generated by MkDocs and Material for MkDocs, attributed to Real Games. The saved HTML links to external/unuploaded images, MP4 demo clips, CSS/JS and other manual pages; the uploaded HTML alone should not be mistaken for an offline-complete website or the functional simulator. Relevant demo clips referenced: Orbit, Fly, First Person cameras; setting point of interest, duplicating sensor and group; mapping PLC I/O points.

## File inventory and integrity
- `image(1).png` — PNG, 2048 × 1255, SHA-256 `4201912aa97208f124e47994707d7cd725bba4fdeb46a628952ff8d61e807b6c`
- `image(2).png` — PNG, 314 × 1610, SHA-256 `3ff34df41379f36fd8fbbaa7734dbf469af81e184fd2c84bd8a2939bcd17ef64`
- `image(3).png` — PNG, 2048 × 938, SHA-256 `82e34950c392a82d9d65d64ed1502e30b2ade68bc9a09c7bd51a63cc47903caf`
- `image.png` — PNG, 2048 × 1257, SHA-256 `2dc9e04f6236c4481245fd552e21c82582c4bfd3098f080aa8d5c15813282a21`
- `index.html` — saved FACTORY I/O HTML documentation, 73,340 bytes, SHA-256 `2d95c4bcb923aed047a2f4ed5937397f0071914e74425f00112ae951820723c4`
- `navigating.html` — saved FACTORY I/O HTML documentation, 81,121 bytes, SHA-256 `952defa07c11f2ad8616f24f7b0484827f453d8cb05c637ca233e638f5169f7c`
- `opening-a-scene.html` — saved FACTORY I/O HTML documentation, 73,792 bytes, SHA-256 `2d122ea9b0dabe4d4c844da5b9749dc9dadc995cfaaf2ead146e38d4166a7064`
- `creating-a-scene.html` — saved FACTORY I/O HTML documentation, 78,729 bytes, SHA-256 `57610ea105ce560d88632d70674e944a5c795de50f2793f8f28626af5082df24`
- `manually-controlling-scene.html` — saved FACTORY I/O HTML documentation, 74,813 bytes, SHA-256 `5b993b209acf1e06fbd019a56098e29d6084dee8e0609898aaaa6b33fc7ab1dc`
- `controlling-with-a-plc.html` — saved FACTORY I/O HTML documentation, 76,624 bytes, SHA-256 `eaf0860233d15d0e6c56299e469109115682e32353d37793442b37d6bdd609c1`

## Appendix — full primary text extracted from the six article bodies
The following is a line-preserving extraction of article text (not all webpage navigation and boilerplate). It helps future questions reference the supplied documents even when linked media are unavailable.

### index.html

```text
Getting Started
¶
This getting started guide walks you through the basics of Factory I/O, including: working with cameras, creating/editing scenes and controlling them with external technologies.
At the end of this guide you will be able to create a virtual factory and use it together with your own PLC.
```

### navigating.html

```text
1. Navigating
¶
One of the most important skills to learn in Factory I/O is how to use cameras.
Cameras are used to navigate in the 3D space and are the key to interacting with parts or building new scenes.
You can use three types of cameras:
Orbit (1)
,
Fly (2)
and
First Person (3)
.
Get used to each type by testing the actions as described below.
Keep in mind that each camera was designed for a specific functional purpose.
1. Orbit Camera
¶
The Orbit camera is the default camera and should be used when building a scene.
This is the only camera that allows you to move through parts without colliding with them.
It works by rotating around a point of interest (indicated by a white dot) which you define by
Double Left-clicking
on a part. Once the point of interest is defined, you rotate the camera around it by holding the
Right Button
and
dragging the mouse
.
New parts dragged from the Palette are created at the height defined by this point, except for parts which are typically placed on the floor, such as conveyors, stations, etc.
Control
Action
Double
Left Button
Set the camera point of interest. The camera will rotate around this point, and new parts will be created at this height.
Right Button
+ Drag
Rotate around the point of interest.
Middle Button
+ Drag
Translate horizontally.
Mouse Wheel
Zoom in and out.
Backspace
Reset to the default position and rotation.
W
or
Up
Move forward.
S
or
Down
Move backward.
D
or
Right
Move right.
A
or
Left
Move left.
2. Fly Camera
¶
The Fly camera is used to move freely in the 3D space.
This camera collides with scene parts but is not detected by sensors.
Control
Action
Double
Left Button
Point the camera to the mouse cursor.
Right Button
+ Drag
Rotate.
Mouse Wheel
Translate vertically.
Left Button
+
Right Button
Move forward.
W
or
Up
Move forward.
S
or
Down
Move backward.
A
or
Left
Move left.
D
or
Right
Move right.
3. First Person Camera
¶
The First Person camera represents a person of 1.8m (~5.9 feet) height.
It should be used when simulating a person in a virtual factory.
It collides with scene parts and, by default, is not detected by sensors.
You may set the First Person Camera to be detected by sensors using the console command
camera.fp_detected = 1
.
Learn more about the
Console
.
Control
Action
Double
Left Button
Point the camera to the mouse cursor.
Right Button
+ Drag
Rotate the camera.
Left Button
+
Right Button
Move forward.
W
or
Up
Move forward.
S
or
Down
Move backward.
A
or
Left
Move left.
D
or
Right
Move right.
Space
Jump.
```

### opening-a-scene.html

```text
2. Opening a Scene
¶
To open a scene choose
Open
(
Ctrl
+
O
) from the
File Menu
and select it from the list by
Left-clicking
.
Factory I/O comes with 21
Scenes
, which can be accessed under the
Scenes
tab.
You may also use any of these scenes as a starting point for a new one by opening and saving it with a custom name.
```

### creating-a-scene.html

```text
3. Creating a Scene
¶
Factory I/O includes a large selection of parts inspired by the most common industrial equipment.
You create a virtual factory by placing and arranging these parts together.
By following the next steps, you will learn how to create a simple sorting system.
Click on
File
and choose
New
(
Ctrl
+
N
) to create an empty scene.
On the
Toolbar
, select the
Orbit
camera - you should use the Orbit camera when editing.
    If the Palette is not visible click on the
Palette
icon.
Choose
Heavy Load Parts
category from the
Palette
and
Left-click
and
Drag
a Roller Conveyor (2m) into the scene.
    When a new part is created it automatically becomes selected, indicated by a white bounding box.
    When you drag a selected part it will move on the horizontal plane. To move it vertically press the
V
key and drag.
Set the camera point of interest on the edge of the conveyor by
Double Left-clicking
on it.
    Next, zoom in with the
Mouse Wheel
to get a closer view. Most parts will be
created at the height of the point of interest
, except those which are typically placed on the floor, such as conveyors, racks, stairs, etc.
On the
Palette
, select the
Sensors
category and
Left-click
and
Drag
a diffuse sensor.
    While holding the
Left Button
down, place the sensor at the edge of the conveyor.
Right-click
on the diffuse sensor and select
Duplicate
(
Left Alt
) from the context menu.
    Next, move the duplicated sensor to the other end of the conveyor.
Select all parts with the
Rectangle Selection Tool
by
Left-clicking
on the scene background and drawing a rectangle intersecting all parts to be included in the selection.
You can group parts together, which will allow you to easily select, move, rotate and duplicate them at once.
Right-click
on top of the selection and choose
Group
(
Ctrl
+
G
).
    At any moment, you can ungroup by
Right-clicking
on a group and selecting
Ungroup
(
Ctrl
+
G
).
    You can select a part within a group by holding the
Ctrl
key and
Left-clicking
.
With the previous group selected,
Right-click
on any part and chose
Duplicate
(
Left Alt
).
    Move the newly created group to a valid position and repeat the process, so you end up with three groups of conveyors and sensors.
    When a red box surrounds groups or parts, it means they are intersecting other parts and will be destroyed when switching from
Edit
to
Run Mode
.
Select
All
from the
Palette
category list, drag a
Turntable
into the scene and place it in front of one of the conveyors.
    To properly place the other two conveyors at each side of the Turntable, you have to
Rotate
them first.
Right-click
on a conveyor and click the
Yaw +
or
-
button (
Y
) to rotate it.
    Most parts only allow rotations of 90º; sensors can rotate freely around the local up axis.
Note that conveyors, like most other parts, have a white arrow indicating the flow direction.
Finally, select the
Items
category and place a pallet on top of the first conveyor.
Now that your work is done, click on
File
and
Save
(
Ctrl
+
S
), give it a name (and optionally a description) and click on
Save
.
```

### manually-controlling-scene.html

```text
4. Manually Controlling a Scene
¶
Before controlling a scene with an external controller (a PLC, for instance) it's recommended to test it manually.
This way you can ensure that the scene layout works as expected.
But first, you need to learn what
Tags
are and how they can be used to control parts.
Any part that is a sensor or actuator has at least one tag.
Tags
are made of a name and a value and can be of two different types:
Sensors Tags
and
Actuators Tags
.
They can hold three different data types: Boolean for on/off values, Float for analog values (real numbers) and Integer for specific data.
Tag values can be
Forced
at any moment, allowing you to play the role of the controller.
To control your scene manually, you
force
the
Actuators Tags
, simulating a value coming from the controller.
Using the scene created on
3. Creating a Scene
, try to transport the pallet to the left conveyor.
Switch to Run mode by clicking the
Play
button (
1
).
Show the actuators tags by clicking on the
Actuators Tags
button (
2
).
Left-click
on a tag to dock it. Once a tag is docked, you can force its value.
    You can
Dock All Tags
and
Clear Docked Tags
on the
View Menu
.
```

### controlling-with-a-plc.html

```text
5. Controlling With a PLC
¶
Now that you have created your factory it's time to control it with a PLC.
But first, you should learn what I/O Drivers are and how to use them.
An I/O Driver is a built-in feature of Factory I/O responsible for "talking" to an external controller.
Factory I/O includes many I/O Drivers, each one for a specific technology.
You select a driver in Factory I/O based on the controller you want to use.
Next, you configure this driver, so it knows how to "talk" to the controller and how to read and write I/O from it.
As an example, this tutorial shows how to use a Siemens S7-1200 PLC.
However, most of the steps described here apply to other drivers as well.
Open the Drivers window by clicking on
File
and next on
Drivers
(
F4
).
    Alternatively, you may open the Drivers window by
Left-clicking
on the current driver displayed on the status bar.
Select
Siemens S7-1200/1500 Ethernet
driver from the list by
Left-clicking
on it.
Click the
Configuration
button to setup the driver according to your PLC model and IP address.
Choose the S7-1200 model and fill in the
Host
field with your PLC's IP address. Proceed to the next step by clicking on the
Back Arrow
(
Esc
).
Press the
Connect
button to connect to the PLC.
    A successful connection will be indicated by a green sign displayed next to the drivers list.
Note that you will find some "Factory I/O (...)" tags displayed in the sensors list (highlighted in the image below).
These are
simulation tags
and can be used by the controller so it can be "aware" of the status and time scale of the simulation (if it's paused, running in slow motion or fast forwarding).
Start mapping tags by dragging and dropping each one onto the intended port.
    To remove a tag from a port just drag it back to the list.
    Once you have mapped all tags, set the simulation to
Run Mode
and test your PLC logic.
If you want to know more about each I/O driver, refer to the
I/O Drivers
.
For additional information on the topics covered in this Getting Started section see the Factory I/O
Manual
.
```

---

# Part II — PLC driver screenshots and mapping video

# FACTORY I/O — I/O drivers, PLC configuration, and tag mapping reference review

**Reviewed:** 8 November 2026  
**Material provided:** seven user-uploaded still images and one user-uploaded MP4, `mapping-io-points.mp4` (8.9 seconds, H.264, 1154×652, 10 fps).  
**Purpose:** reference companion to `FACTORY_IO_REFERENCE_REVIEW_2026-11-08.md`, especially for later PLC Skills Lab questions.  
**Evidence level:** visual/source review only. This is not a runtime test of FACTORY I/O or a direct test of a real Siemens PLC.

## 1. Individual screenshot observations

### `open-drivers.jpg` — how to open the driver settings
- An open **FILE** menu in FACTORY I/O on top of the warehouse simulation view.
- Menu items: **New (Ctrl+N)**, **Open (Ctrl+O)**, **Save (Ctrl+S)**, **Save As... (Ctrl+Shift+S)**, **Options...**, **Drivers (F4)**, and **Exit**.
- **Drivers (F4)** is surrounded by a yellow highlight, documenting the path to the driver interface.
- **EDIT** and **VIEW** are visible beside FILE on the dark top menu bar.

### `driverdd-s7-1200.jpg` — available driver choices
- The DRIVER screen has a back arrow and a driver selection dropdown, initially showing **None**.
- Dropdown choices visible, in order:
  1. None
  2. Advantech USB 4704 & USB 4750
  3. Allen-Bradley Logix5000
  4. Allen-Bradley Micro800
  5. Allen-Bradley MicroLogix
  6. Allen-Bradley SLC 5/05
  7. Automgen Server
  8. Control I/O
  9. MHJ
  10. Modbus TCP/IP Client
  11. Modbus TCP/IP Server
  12. OPC Client DA/UA
  13. Siemens LOGO!
  14. Siemens S7-200/300/400
  15. Siemens S7-1200/1500
  16. Siemens S7-PLCSIM
- The **Siemens S7-1200/1500** choice is highlighted with a yellow rectangle.
- This shows categories/options available in the pictured build, not whether the user has compatible controllers or whether every driver is configured or works.

### `open-driver-config.png` — disconnected/unconfirmed driver header
- Full-width dark-grey header with back arrow, **DRIVER**, selected **Siemens S7-1200/1500 Ethernet**, and red actions **CONNECT**, **CONFIGURATION**, **CLEAR**.
- **CONFIGURATION** is highlighted yellow. No green status check appears in this capture.
- The screenshot indicates the configuration entry point, not a successful connection.

### `driver-config.png` — specific Siemens configuration fields
- Left pane title **CONFIGURATION**, back arrow highlighted yellow, driver/provider navigation list (at least Advantech, several Allen-Bradley entries, Automgen Server shown).
- Main pane has heading **PLC** in red.
- **Auto connect** checkbox shown unchecked.
- **Model** dropdown shows **S7-1200**.
- **Host** text field is empty and shows **Enter the host address**.
- **Network adapter** dropdown shows **Realtek PCIe GBE Family Controller**.
- Yellow highlight encloses Model and Host, emphasizing those setup steps.
- This specific screenshot does not show a populated host address or a successful connection.

### `successful-connection.png` — visual connected status
- Same DRIVER header, with selected **Siemens S7-1200/1500 Ethernet**.
- A **green circular check** appears beside the selected driver.
- Main action changes from **CONNECT** to **DISCONNECT**; **CONFIGURATION** and **CLEAR** remain visible in red.
- This is visual evidence of the application displaying connected status; it does not independently prove a physical PLC connection or exchanged live data.

### `simulation-tags.jpg` — simulation sensor/control tags
- Under **SENSORS**, **Diffuse Sensor 1** through **Diffuse Sensor 6** are visible, each with a green type indicator.
- Four special **FACTORY I/O** simulation tags, outlined in yellow:
  - `FACTORY I/O (Paused)` — green indicator
  - `FACTORY I/O (Reset)` — green indicator
  - `FACTORY I/O (Running)` — green indicator
  - `FACTORY I/O (Time Scale)` — blue indicator
- Below the highlight: `Turntable 1 (Limit 0)` and `Turntable 1 (Limit 90)` (green). This cropped still does not include all possible scene tags.
- By the type legend shown in the video, green = Boolean and blue = Float, so Paused/Reset/Running are Boolean and Time Scale is Float.
- The four Factory I/O tags provide simulator-level status/control visibility, distinct from physical scene sensors.

### `driver-diagram.jpg` — conceptual driver architecture
- Blue grid/blueprint illustration, title **I/O Drivers**.
- Upper box: **Factory I/O — I/O Driver: Siemens S7-1200**.
- Lower box: **PLC — S7-1200**.
- A yellow dashed vertical line, marked **Ethernet**, connects the two.
- A downward white arrow marked **sensors** leads from Factory I/O toward the PLC; an upward arrow marked **actuators** leads from PLC toward Factory I/O.
- Concept illustrated: sensor states are provided to PLC inputs, and PLC commands are applied to virtual actuators through the configured driver.
- It is a conceptual communication diagram, not a wiring schematic, driver implementation specification, packet capture, or evidence of a live connection.

## 2. MP4 video — `mapping-io-points.mp4`

### Video metadata
- Runtime: **8.9 seconds**; resolution: **1154×652**; 10 fps; H.264 video; no sound stream reported by probe.
- FACTORY I/O driver workspace has a blurred factory background, dark header, **SENSORS** (left), PLC I/O mapping panel (middle), **ACTUATORS** (right).
- Header displays **Siemens S7-1200/1500 Ethernet**, green status check, and **DISCONNECT / CONFIGURATION / CLEAR**.
- Center panel displays **Host: 192.168.1.23** (an address visible in the example recording, **not a recommended default**), **Powered by ComDrvS7**, `www.mhj-tools.com`.

### Visible workspace and tag catalog
- Left scene/simulation sensor tags, in order:
  - Diffuse Sensor 1, Diffuse Sensor 2, Diffuse Sensor 3, Diffuse Sensor 4, Diffuse Sensor 5, Diffuse Sensor 6
  - FACTORY I/O (Paused), FACTORY I/O (Reset), FACTORY I/O (Running), FACTORY I/O (Time Scale)
  - Turntable 1 (Limit 0), Turntable 1 (Limit 90), Turntable 1 (Back Limit), Turntable 1 (Front Limit)
- Right actuator tags, in order:
  - Roller Conveyor (2m) 1
  - Roller Conveyor (2m) 2
  - Roller Conveyor (2m) 3
  - Turntable 1 Turn
  - Turntable 1 Roll (+)
  - Turntable 1 Roll (-)
- PLC panel input bit positions shown: **I0.0, I0.1, I0.2, I0.3, I0.4, I0.5, I0.6, I0.7**. Input double-word positions: **ID100, ID104, ID108, ID112**.
- PLC output bit positions shown: **Q0.0, Q0.1, Q0.2, Q0.3, Q0.4, Q0.5, Q0.6, Q0.7**. Output double-word positions: **QD100, QD104, QD108, QD112**.
- Legend at lower left: **Bool** (green), **Float** (blue), **Int** (orange), **Any** (white).
- A small eye icon appears near the actuator heading. Its exact function cannot be established from this short clip.

### Visible mapping sequence
- Begins with no assigned tag labels inside the I/O panel.
- The cursor drags **Diffuse Sensor 1** from the sensor list onto **I0.0**; its mapped name appears beside that input.
- It then drags **Diffuse Sensor 2** onto **I0.1**.
- The cursor next drags **Roller Conveyor (2m) 1** from the actuator list onto **Q0.0**.
- Finally it drags **Roller Conveyor (2m) 2** onto **Q0.1**.
- The last video frame visibly displays all **four** mappings simultaneously:

| Source tag | Direction relative to PLC | Destination in center panel | Data type |
|---|---|---|---|
| Diffuse Sensor 1 | Scene sensor → PLC input | I0.0 | Bool (green) |
| Diffuse Sensor 2 | Scene sensor → PLC input | I0.1 | Bool (green) |
| Roller Conveyor (2m) 1 | PLC output → scene actuator | Q0.0 | Bool (green) |
| Roller Conveyor (2m) 2 | PLC output → scene actuator | Q0.1 | Bool (green) |

- Mapping is presented visually using drag-and-drop with label display at matched positions. The clip does not show the mapping of all available tags, data transfer on a network, code execution inside the PLC, turning conveyors in the 3D scene, or a full round-trip test.

## 3. Source-grounded end-to-end flow

1. Open **File → Drivers**, or press **F4**.
2. Choose the relevant driver in the dropdown; the example selects **Siemens S7-1200/1500 Ethernet**.
3. Open **Configuration**, select the appropriate PLC **Model**, provide the **Host** address, and review the **Network adapter** and optional **Auto connect** setting.
4. Return to the driver screen and select **Connect**. The example screenshots then display a **green check** and **Disconnect**.
5. Inspect the **SENSORS** and **ACTUATORS** lists and the controller's input/output address columns.
6. Use drag-and-drop to link each scene **sensor** to the appropriate PLC **input**, and each scene **actuator** to the appropriate PLC **output**.
7. Observe status and run the PLC/controller logic to validate behavior, with actual test evidence required before claiming functional integration.

The sequence is based on what is shown in the seven still images and short video, supplemented only by the earlier **user-provided** Getting Started documentation. It should not be treated as a guarantee about all FACTORY I/O versions or all PLC hardware.

## 4. Notes for future PLC Skills Lab benchmarking

These are *design observations/inferences*, not proof of a working PLC Skills Lab feature:
- Driver workflow has clear stages: **driver selection → configuration → connection state → point mapping**.
- The map editor separates **scene input tags**, **PLC address slots**, and **scene output tags** visually; makes directionality legible; and color-codes types.
- The exposed simulation tags (paused/reset/running/time scale) make the virtual system controllable from the driver side.
- A credible lab implementation would need real tag data flow, type compatibility, PLC scan semantics, stable mapping persistence, connection-state semantics, faults, and testing. A UI-only reproduction would not establish equivalence.
- For a browser-based virtual PLC implementation, the displayed Ethernet PLC integration is only a *reference pattern*; hardware/network browser access may need a separate safe bridge and cannot be assumed from the screenshots.

## 5. What is NOT established by the sources

- The video and stills do not prove a PLC was physically connected, despite the visible green check.
- The video does not prove TCP/Ethernet packets are exchanged or that the PLC outputs change the virtual scene.
- The host `192.168.1.23` is merely what is displayed in the clip; it is not a universal host or configuration prescription.
- No source code, driver implementation, project file, PLC program, electrical wiring detail, or interface specification was uploaded.
- The screenshots do not establish application version, licensing terms, supported OSes, or whether each listed driver works with actual hardware.

## 6. SHA-256 source file inventory

- `open-driver-config.png` — 9,461 bytes, 1155×85, SHA-256 `2b549bd1d0f7c61ebb23ae865238d5af3b0c625b90e6a6f438a7ecbe4069cde6`
- `open-drivers.jpg` — 61,535 bytes, 499×319, SHA-256 `77fac5e7bc2a7eca2aac4c094c654b1786fe477ec9d5b3c13bce21ac769b8d3c`
- `simulation-tags.jpg` — 40,348 bytes, 400×360, SHA-256 `20398d1fc63332408dba77fe03030f7dcd14465aa3a12cd1d2797fd4817c7a2a`
- `successful-connection.png` — 10,000 bytes, 1155×85, SHA-256 `b30afd20ecabb42f34486157f89ba36e7febd800ca86bf5ee294ea80cea9863d`
- `driver-config.png` — 31,805 bytes, 1155×380, SHA-256 `795650e8262e3825beb1b45c72c2ea3892b66a1e0f7406c5e91e881368b90e44`
- `driverdd-s7-1200.jpg` — 107,766 bytes, 867×588, SHA-256 `4c2e44ae5926e7d3d97d5025e04c237946eb84bcf9e01733111436410b3a4876`
- `driver-diagram.jpg` — 71,008 bytes, 1140×470, SHA-256 `f70a38a0461c002cece3805c905488bc05813904b600fd7eef54f6512a400299`
- `mapping-io-points.mp4` — 195,325 bytes, SHA-256 `7ab254f064f65aa35a895c1c6f71b42d30448c7e44f26e8df6150c24409f287a`


---

# Added reference set 3 — scene editing / placement / rotation / manual forcing (9 uploads)

# FACTORY I/O — scene editing, parts placement, rotation, sensors and forced tags

**Review date:** 8 November 2026. **New uploads:** six screenshots and three short MP4 clips (nine source files). This extends the prior 18-file benchmark/reference set to **27 total uploaded source files**, covering UI, scene editing, and driver mapping. These are *screenshots/videos of an application*, not its code or an executable simulation environment. Marked highlights and tutorial arrows visible in the images are explanations, not necessarily native editor UI.

## 1. Direct observations from the six screenshots

### `toggle-palette.png` — showing / opening the Parts palette
- Dark top application toolbar with play/pause and various tool icons.
- A **3 × 3 square/grid icon** at far upper right is emphasized by a yellow box; yellow curved arrow points to the **right-side parts palette**.
- Palette has an **All** category dropdown, **Search** field, and a three-column scrolling thumbnail grid including source/sink arrows and cardboard-box items.
- This is an illustration of the *parts palette toggle/control*, not proof of the effect of every icon on the toolbar.

### `drag-part.jpg` — insert Roller Conveyor from Heavy Load Parts
- **Heavy Load Parts** selected as palette category; search field shown; first equipment thumbnails include a machine, angled item, and roller conveyors labeled **2m**, **4m**, **6m**.
- Yellow curved arrow points from a **2m roller conveyor** part icon to a roller-conveyor model placed in the scene.
- The model is inside a **white wireframe bounding box**, indicating selected/newly placed part. A grid overlays the concrete factory floor.
- A vertical arrow next to the selected part is labeled **V key**, illustrating **vertical translation** while dragging (the associated saved documentation explicitly describes `V` + drag).
- No reliable evidence here of snapping tolerance, collision resolution, or rigid-body physics.

### `place-diffuse-sensor.jpg` — place/aim a diffuse sensor
- Palette category **Sensors**, with assorted sensor/control-device icons. A yellow arrow points from a **small blue sensor** thumbnail to an instance installed along a conveyor side rail.
- The blue sensor has a wireframe selection box, a **red circular directional/angle guide**, and a **white dashed line** across the conveyor, visually representing the sensing direction/beam.
- A top toolbar and bottom status bar are visible. Sensor placement and orientation are illustrated; no proof of a measured detection distance or triggered sensor signal in this still.

### `conveyor-arrow.jpg` — physical direction marking
- Close-up of a light blue/grey conveyor side frame, rollers, fasteners, and a blue mounted element.
- A **white arrow-like directional marking** is painted/shown on the metal frame, used in the tutorial as a visual clue for conveyor transport direction.
- The still does **not** show actual transport motion or confirm reverse-direction behavior.

### `rotate.jpg` — rotating/alignment around a turntable
- Scene includes three roller conveyors around a central **round turntable**, a pallet with a box on the left conveyor, blue sensors on rail edges, and the Sensors palette on right.
- A foreground roller conveyor is selected inside a white wireframe bounding box; a **yellow curved arrow** shows its intended rotation toward alignment.
- The dark contextual menu directly displays **Yaw** with `−` and `+` controls and shortcut **Y**. **Roll** (R), **Pitch** (T), and **Fine Rotation** options appear greyed/inactive in this frame. Also visible: **Reset Fine Rotation**, **Horizontal Trans.**, **Vertical Trans.** (`V`), **Duplicate** (`Alt`), **Delete** (`Delete`), **Ungroup** (`Ctrl+G`), **Configuration** (greyed).
- Presence of shortcuts and disabled menu controls is observed, not evidence they are all active for this item or every item.

### `docked-tag.jpg` — manual actuator force and feedback in 3D
- Run-mode tutorial screenshot shows a roller-conveyor and turntable system with box/pallet and red dashed visual lines along conveyor rails.
- Upper-left dark floating/docked tag bar displays **`Roller Conveyor (2m) 3`**, a **blue circular info icon**, the status **`FORCED`**, and a close **`X`** at its right.
- A large cyan scene label reads **`Roller Conveyor (2m) 3`** over the selected conveyor. The right-side **Sensors** palette is still visible.
- This clearly evidences a **docked/forced actuator tag display**; it does not by itself demonstrate how fast or far a pallet moves, or signal flow from a physical PLC.

## 2. MP4 clip reviews — sampled across each timeline

### `set-interest-point.mp4` (5.1 seconds, 512×308, H.264, 10 fps)
- The view begins with one roller conveyor and changes toward a close-up of its top edge/roller region as the operator moves and zooms the orbit camera.
- A **small white dot** is visible on the upper edge after the point-of-interest interaction; the camera view then shifts around/near that location.
- The reference documentation establishes that **double left-click sets the Orbit camera's point of interest**, which is used as its rotation anchor and the placement height for many new parts. The visible clip supports the white-dot anchor and a change in camera framing; mouse-button timing is not independently verifiable from the video alone.

### `duplicate-sensor.mp4` (5.0 seconds, 512×308, H.264, 10 fps)
- Begins with one conveyor carrying a blue sensor near its upper-right side rail.
- A second selected/preview sensor appears, indicated by red selection/orientation cue and a wireframe placement area; it is dragged along the length of the conveyor toward the opposite near-side end.
- Final frames show **two blue sensors on the same side rail** at different positions and **two long red guide/beam traces** alongside the conveyor.
- Consistent with the Getting Started documentation's **Duplicate (`Alt`)** workflow, but the video alone does not prove which key was held at every frame, nor does it show live detection changes.

### `duplicate-group.mp4` (6.4 seconds, 512×308, H.264, 10 fps)
- Begins with **two conveyor assemblies** that each show blue end sensors, arranged near an angle/turn.
- Operator selects the upper conveyor assembly, opens a contextual menu, and highlights **Duplicate** (`Alt`).
- A new conveyor/sensor assembly appears with a white wireframe selection box and is moved toward the lower-right of the others.
- Around 3.6 seconds the copied assembly is **red/translucent**, visually illustrating an invalid/intersecting placement; it later becomes opaque when moved clear.
- Final frame shows **three conveyor assemblies** including the newly duplicated one with visible small blue sensors. This demonstrates copied spatial assemblies and an intersection warning; it does **not** establish exact grouping mechanics or whether any parts were destroyed when subsequently switching to Run.

## 3. Key controls explicitly supported by supplied documentation / images

| UI function | Control / behavior | Source |
|---|---|---|
| Show palette | 3×3 grid toolbar button opens or toggles palette | `toggle-palette.png` |
| Browse parts | Category dropdown and Search, item thumbnails | `toggle-palette.png`, `drag-part.jpg`, `place-diffuse-sensor.jpg` |
| Place equipment | Drag part thumbnail into 3D scene, new part has white wireframe bounds | `drag-part.jpg`, prior `creating-a-scene.html` |
| Move part vertically | **V** + drag selected part | `drag-part.jpg`, prior saved docs |
| Set orbit point of interest | **Double left-click** on a part; white-dot anchor | `set-interest-point.mp4`, prior `navigating.html` |
| Duplicate a part/group | Context menu **Duplicate** (**Alt**) | `rotate.jpg`, `duplicate-group.mp4`, `duplicate-sensor.mp4`, prior docs |
| Group or ungroup | **Ctrl+G** per documentation; **Ungroup** item visible | `rotate.jpg`, prior `creating-a-scene.html` |
| Rotate selected conveyor | Context menu **Yaw** `−/+`, keyboard **Y** | `rotate.jpg`, prior docs |
| Check travel direction | White direction marking/arrow on conveyor | `conveyor-arrow.jpg`, prior docs |
| Orient sensor | Rotate selected blue sensor; dashed projected beam/line | `place-diffuse-sensor.jpg` |
| Warn on collision | Red / translucent intersecting part placement | `duplicate-group.mp4`, prior docs |
| Manually force actuator | `FORCED` in docked actuator tag display | `docked-tag.jpg`, prior `manually-controlling-scene.html` |

## 4. Recommended interpretation for later PLC Skills Lab benchmarking

This is **benchmark interpretation**, not proof of existing PLC Skills Lab functionality:
- A useful scene editor needs a reliable part catalog, 3D placement feedback, part selection, orientation controls, move/copy/group flows, and an explicit invalid-placement visual state.
- Sensor placement should make beam direction legible; the runtime must later **compute actual sensing events**, not merely display guide lines.
- The orbit point of interest links navigation to construction height, an important usability detail worth benchmarking.
- Conveyor direction needs to be legible in 3D. A labeled **forced tag** is helpful for commissioning, but should also have clear mode and control/PLC ownership semantics to avoid confusing override commands with PLC-driven outputs.
- None of these nine uploads is a performance benchmark, source of industrial physical accuracy numbers, evidence of a functioning PLC scan cycle, or demonstration of working PLC connectivity.

## 5. New source-file inventory and integrity

| File | Type | Dimensions / media info | Bytes | SHA-256 |
|---|---|---|---:|---|
| `rotate.jpg` | image | 1154×648 | 419,364 | `7c3b834bd344ca73613fc92ecdb168f24e6171fedfea33d0e05ee64d20212832` |
| `toggle-palette.png` | image | 509×340 | 140,454 | `bcc9f58b2d9fcbee6180c334d055162e8c3013678ecaf5dba6abf8e071f5f87c` |
| `conveyor-arrow.jpg` | image | 528×329 | 27,482 | `36d1491f8a469687794e50aaceb7b6ca915f80a63d33a0a4d38755f8ae5667c3` |
| `drag-part.jpg` | image | 1154×648 | 396,696 | `8fa0def1889b0b857c7bad07c28b82a767cca589095a91d9ceb5b4e4c87abd38` |
| `place-diffuse-sensor.jpg` | image | 1154×648 | 343,697 | `d47edc34800130bcb56830d2e6bf7ade13a231b047160a503543a39d05817e81` |
| `docked-tag.jpg` | image | 1154×648 | 386,262 | `ae81457ddf4410033e4505c4b3c1f504aa3340ada5ee96012b7326f4c6fe03d3` |
| `set-interest-point.mp4` | video | 512×308, h264, 10/1 fps, 5.1s | 210,929 | `0d784dfae3e792595207c5d4c7a6b1e5f46e9d0344c8dba0b8c1cacb914a860f` |
| `duplicate-group.mp4` | video | 512×308, h264, 10/1 fps, 6.4s | 160,307 | `08683a1cf6c6a58d6bbcc03c4d9020792bb7242933eb7a1086490d2fccdee812` |
| `duplicate-sensor.mp4` | video | 512×308, h264, 10/1 fps, 5.0s | 97,329 | `5c2f46352739ae9b2d37c18b3e8f388bd94d200720ea2ccaa4fb1f785b36f369` |

**Evidence boundaries:** The edited yellow highlight boxes/arrows in the tutorial screenshots are visual annotations. Video sampling supports visible action order, not exact pointer events or pressed keyboard state. The video frames show an editor workflow, not live I/O packets or actual PLC control. The exact user-provided original screenshots and videos are the primary evidence, and the prior official saved documentation provides contextual shortcuts.


---

<!-- FACTORY_IO_CAMERA_AND_SCENES_7_FILES_2026-11-08 -->

# FACTORY I/O – Camera navigation, scene opening, and overview reference review

**Reviewed:** 8 November 2026. **Batch:** Seven newly supplied files: four JPG screenshots and three MP4 camera examples. These join the previous 27 reference assets (new total **34 original source files: 21 screenshots, six saved HTML documentation pages, seven MP4s**). This document records the supplied assets for future PLC Skills Lab benchmarking, not a functional application test.

## A. Four screenshot reviews

### `menu-open(1).jpg` – File menu / Open

- Dark FACTORY I/O application chrome with FILE selected red alongside EDIT and VIEW.
- Drop-down options: **New** (`Ctrl+N`), **Open** (`Ctrl+O`), **Save** (`Ctrl+S`), **Save As…** (`Ctrl+Shift+S`), **Options**, **Drivers** (`F4`), **Exit**.
- A yellow outline emphasizes **Open**, reinforcing the scene-loading entry point already documented in `opening-a-scene.html`.
- Only the menu is shown: a scene is not being loaded within this still image.

### `included-scenes(1).jpg` – Scene browser / excerpt of predefined scenes

- Left pane title **Open Scene**, with a back arrow and two sections: **My Scenes** and **Scenes**, the latter highlighted in red.
- Top instruction: scenes are inspired by common industrial applications, presenting beginner-to-advanced challenges, and may be edited and used as a base for new scenes.
- Top-right sorting label **Order by: Name** with an ascending caret.
- The visible portion shows **15 thumbnails**, arranged in 3 rows of 5; the screenshot cuts off below the last visible row. Their labels, in displayed order:
  1. `1 - From A to B` — move a box to a sensor;
  2. `2 - From A to B (Set and Reset)` — move a box from sensor A to sensor B;
  3. `3 - Filling Tank (Timers)` — fill/empty a tank with timers;
  4. `4 - Queue of Items (Counters)` — load and unload three boxes on a conveyor;
  5. `Assembler` — assemble lids and bases with a two-axis pick-and-place;
  6. `Assembler (Analog)` — analogous assembly with analog values;
  7. `Automated Warehouse` — transport/store/retrieve boxes from a rack;
  8. `Buffer Station` — buffer and separate up to five boxes;
  9. `Converge Station` — merge two paths into one;
  10. `Elevator (Advanced)` — collect up to five items into a stackable box using an elevator, items arriving at different floors;
  11. `Elevator (Basic)`;
  12. `Level Control`;
  13. `Palletizer`;
  14. `Pick & Place (Basic)`;
  15. `Pick & Place XYZ`.
- **Important reconciliation:** This is a partial viewport of the same **21 included scenes** cataloged in the original reference, *not* a new or different total of 15. The visible descriptors do not establish their control logic or operation.

### `ui-cameras(1).jpg` – Three camera choices in editor

- Huge empty tiled concrete floor within warehouse setting, top FILE / EDIT / VIEW and simulation toolbar with Play, Pause and other mode controls.
- A yellow box highlights **three adjacent camera buttons**, annotated **1, 2, 3** with a yellow pointer: (1) **Orbit** (selected/red highlighted), (2) **Fly**, (3) **First Person**. This identification is supported by the uploaded official `navigating.html` documentation and the accompanying three named video examples.
- Right docked searchable Parts palette: **All**, Search, cardboard boxes/pallets, colored flat parts, roller conveyors marked **2m / 4m / 6m**.
- Bottom title identifies a **New Scene** in FACTORY I/O v0.2.31 Ultimate Edition (as displayed in this screenshot), plus selected **Siemens S7-1200/1500 Ethernet** driver on status bar. This is the version shown in this screenshot, not evidence of the current/latest version.
- Lower-left on-screen navigation wheel/zoom control is visible.

### `overview(1).jpg` – Example conveyor-turntable scene

- 3D top-angle overview shows **three roller-conveyor approaches around a central circular turntable**. A wooden pallet holding a cardboard box appears on the foreground/left approach.
- Two additional roller-conveyor branches extend toward upper-left and right. Grey rollers and supports, red dashed sensor/guide lines, small blue-mounted components/sensors, and orange motor equipment are visible.
- Circular turntable top has slats, alignment/position details and a curved directional mark.
- Right-side searchable **All** Parts palette remains open, using a 3-column parts grid.
- Lower-left camera navigation circle; bottom bar says **FACTORY I/O v0.2.30 - Ultimate Edition - New Scene** and Siemens S7-1200/1500 Ethernet. The visible version differs from `ui-cameras(1).jpg` and need not be reconciled as a single app version.
- The still does **not** prove that pallets actually move, that the turntable is motorized in this capture, or that the PLC has a real connection.

## B. Three MP4 camera demonstrations, sampled along entire timelines

### `orbit-camera(1).mp4` — 3.8 seconds, 598×350, H.264, 10 fps, 38 frames

- Begins with an oblique overhead view of a short roller conveyor on concrete floor, grey rollers and frame, two orange motor housings beneath, a small blue device attached to the front rail, and a red dashed beam/line across the conveyor.
- Over the first ~1 second the camera moves/zooms closer toward the blue device and front rail; at about 1.6 s a **white selection wireframe**, **red circular orientation/rotation guide**, and **white dashed line** become visible around/from that device.
- At later moments the perspective rotates/moves around the selected region, bringing the rail from a diagonal to a more front-facing position while the blue device remains near the center/lower center.
- Consistent with Orbit's documentation purpose: inspect/rotate around an interest point while editing. The clip does **not** establish exact held mouse buttons or whether the red circular guide came from selecting/rotating the sensor rather than navigation itself.

### `fly-camera(1).mp4` — 3.2 seconds, 598×350, H.264, 10 fps, 32 frames

- Opens on a distant elevated view of a standalone roller conveyor on a broad concrete floor.
- The camera approaches progressively, enlarging the rollers and exposing the underside-mounted **orange motor/gear assembly**, **blue sensor-like side-rail component**, and **red dotted beam/guide**.
- Ends in a close-up of the side rails/rollers and internal motor equipment, without a visible rotation/selection gizmo or editing context menu.
- This documents free-space inspection/approach; video alone does not establish keyboard commands, camera collision handling, or the device’s actual detection state.

### `first-person-camera(1).mp4` — 2.6 seconds, 598×350, H.264, 10 fps, 26 frames

- Displays eye-level view toward a conveyor/equipment station and a wall with large glass/mesh panels; a cardboard box sits on a conveyor segment to the right.
- A tall pale machine/guard-like mechanism in the middle rises/tilts upward into the foreground over roughly 0.7–1.8 s, while the apparent view shifts closer and then settles on the wall/panel area by 2.5 s.
- A cursor/hand symbol is visible in some frames. The camera is much closer to the apparent human viewpoint than the elevated Fly and Orbit examples.
- This **does not prove** the mechanism was triggered by the camera, a safety sensor, a collision, or a PLC command. It only demonstrates the rendered movement and eye-level perspective.

## C. Documentation-correlated camera behavior (from earlier uploaded official HTML)

These controls were explicitly documented in `navigating.html`; the clips illustrate perspectives but **do not separately verify keystrokes or all physics behaviors**.

| Camera | Purpose / physical behavior as documented | Key documented controls |
|---|---|---|
| Orbit (1) | Default construction/editing camera; can pass through parts, centered on white-dot point of interest; point height affects newly placed parts other than common floor items | Double left-click set point; right-drag orbit; middle-drag pan; wheel zoom; Backspace reset; WASD or arrows move |
| Fly (2) | Free movement through 3D environment; physically collides with parts; not detected by sensors | Double left-click face point; right-drag rotate; wheel rise/fall; W or both mouse buttons forward; WASD/arrows move |
| First Person (3) | Camera simulates a ~1.8m tall person, collides with parts, not detected by sensors by default; detection can be enabled through `camera.fp_detected = 1` | Fly-style navigation plus Space to jump |

## D. Evidence boundaries and PLC Skills Lab benchmark relevance

- These seven files **reinforce rather than replace** the prior 27; camera switching, saved scene browser and one example turntable conveyor layout are now more clearly shown.
- Tutorial screenshots contain **editorial yellow boxes/arrows**; distinguish them from controls actually built into the app.
- Video frames provide time order and view changes but **not a keypress overlay, live PLC traffic, full camera collision validation, or reliable evidence of input-driven machine movement**.
- Useful benchmark areas for PLC Skills Lab: direct scene-opening affordance, reusable scene-gallery thumbnails, visually separate Orbit/Fly/First Person navigation modes, spatial inspection of machinery, and consistent part selection/orientation overlays. These are reference/design observations, **not existing implemented PLC Skills Lab features**.
- Screenshots display different historical FACTORY I/O version labels (v0.2.30 and v0.2.31). No current-version claim is made.

## E. File inventory / integrity

| Uploaded original | Media specification | Bytes | SHA-256 |
|---|---|---:|---|
| `menu-open(1).jpg` | 499 × 319 pixels | 62,323 | `85dc54bb93f37526d94199cdd14de9187c0b4b3f1621af61f7902baf706ed876` |
| `included-scenes(1).jpg` | 1155 × 578 pixels | 149,358 | `c95bb07e86be8a8312cfb23b6593770ed3aefd9e247ded8b3b16b0b467fc7e5b` |
| `ui-cameras(1).jpg` | 1155 × 649 pixels | 87,444 | `cdc94660455080c35a532cf0308570d8dabf72bd2f4db8feda9db6bbda9f9a86` |
| `overview(1).jpg` | 1155 × 650 pixels | 185,075 | `ca5e8d6e6e417fc61aa6c3f163b1902c5929c673c0159e11e33fb2a703ce0987` |
| `first-person-camera(1).mp4` | 598 × 350, H.264, 10/1 fps, 2.6 seconds, 26 frames | 132,587 | `7946fba1bb4606c59eec477ff076e1baed18a1394470d2675d27a3213022cb42` |
| `fly-camera(1).mp4` | 598 × 350, H.264, 10/1 fps, 3.2 seconds, 32 frames | 219,223 | `b750ed1a363a61497c3a789867d81e90ec74e25f1ee6e46250d576c3f1670616` |
| `orbit-camera(1).mp4` | 598 × 350, H.264, 10/1 fps, 3.8 seconds, 38 frames | 253,913 | `fa85101558e0d67d648ec6c1877a2b4b90ca1dcf778dcbee8a7611019f791df9` |

### Optional local video frame-contact sheets generated for analysis

- `factory_io_camera_navigation_review_frames/orbit-camera(1)_contact.jpg`
- `factory_io_camera_navigation_review_frames/fly-camera(1)_contact.jpg`
- `factory_io_camera_navigation_review_frames/first-person-camera(1)_contact.jpg`

Each contact sheet samples eight timestamps across its original clip. The MP4s themselves remain the primary evidence.


---

# 2026-11-09: Repeat camera and scene batch — exact-duplicate verification

The user supplied seven more filenames with the same camera and scene reference subjects. All seven were verified **byte-for-byte identical** to the seven files previously reviewed on 2026-11-08 (the original names used `(1)` suffixes). Each pair also has matching SHA-256. The reviewed content and previous camera-scene analysis above apply without modification; no new screenshots or unique video frames have been introduced.

| New submission | Previously reviewed identical file | Bytes | SHA-256 |
|---|---|---:|---|
| `ui-cameras.jpg` | `ui-cameras(1).jpg` | 87,444 | `cdc94660455080c35a532cf0308570d8dabf72bd2f4db8feda9db6bbda9f9a86` |
| `menu-open.jpg` | `menu-open(1).jpg` | 62,323 | `85dc54bb93f37526d94199cdd14de9187c0b4b3f1621af61f7902baf706ed876` |
| `included-scenes.jpg` | `included-scenes(1).jpg` | 149,358 | `c95bb07e86be8a8312cfb23b6593770ed3aefd9e247ded8b3b16b0b467fc7e5b` |
| `overview.jpg` | `overview(1).jpg` | 185,075 | `ca5e8d6e6e417fc61aa6c3f163b1902c5929c673c0159e11e33fb2a703ce0987` |
| `first-person-camera.mp4` | `first-person-camera(1).mp4` | 132,587 | `7946fba1bb4606c59eec477ff076e1baed18a1394470d2675d27a3213022cb42` |
| `fly-camera.mp4` | `fly-camera(1).mp4` | 219,223 | `b750ed1a363a61497c3a789867d81e90ec74e25f1ee6e46250d576c3f1670616` |
| `orbit-camera.mp4` | `orbit-camera(1).mp4` | 253,913 | `fa85101558e0d67d648ec6c1877a2b4b90ca1dcf778dcbee8a7611019f791df9` |

**Unique source-reference count remains 34**: 21 screenshots, six official Getting Started HTML pages, and seven MP4 clips. With the seven duplicate re-uploads, there have been 41 individual upload submissions in total, but there are still only 34 distinct source files. This batch does not establish any new FACTORY I/O behavior or change the evidence limitations around camera controls, physical PLC connections, or runtime simulation.


---

# 2026-11-09: Second repeat upload of camera and scene materials

The user submitted the same seven camera/scene files again after the previous November 9 duplicate verification, requesting that they be added to the reference. Each currently mounted file was compared by SHA-256 with its separately preserved original `(1)` reference and **all seven hashes match exactly**. No new unique source images, video frames, documented features, or PLC evidence are introduced. This is a **second repeated batch**, already covered by the detailed camera and scene review above.

- Screenshots: `ui-cameras.jpg`, `menu-open.jpg`, `included-scenes.jpg`, `overview.jpg`.
- Videos: `first-person-camera.mp4`, `fly-camera.mp4`, `orbit-camera.mp4`.
- Existing unique reference inventory: **34** source files — **21** screenshots, **6** Getting Started HTML pages, **7** MP4 videos.
- Total upload submissions across original batches and both exact-repeat batches: **48** (34 originals + 7 duplicates + 7 duplicates).
- Scope remains reference-only for PLC Skills Lab; these user-supplied files do not prove an operational simulator, live PLC traffic, physical PLC integration, or camera collision correctness.