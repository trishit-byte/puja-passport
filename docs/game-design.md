# Game Design: Puja Passport

## Identity

- **Genre:** cozy 3D exploration with a gentle clock. **Platform:** browser on desktop, phone and tablet. **Players:** one.
- **Setting:** the fictional Bengali city of Anandapur (আনন্দপুর · आनंदपुर) on Ashtami night of Durga Puja.
- **Goal:** hop all ten pandals and ring each one's bell for a stamp in your **Puja Passport**, in any order, between 6:00 PM and 4:00 AM.
- **On the way:** eat, dance, sit, offer pranam, take selfies and talk to people.
- **Emotional target:** people who know Durga Puja should feel nostalgic, and people who don't should want to go.

## Pillars

1. **Discovery is the reward.** There's no combat, health or currency. The clock adds gentle urgency, not pressure: 45 minutes covers about 6× the optimal route (see testing-and-performance.md).
2. **A small world that feels big.** The city is a tiny planet with a near, curved horizon. Lit landmark towers peek over the curve, and a minimap and compass point the way.
3. **Respect the sacred.** The protima is never interactive or a puzzle. Interactions are things a visitor really does: ring the visitors' bell at the entrance, fold your hands, eat at a stall, dance at a para DJ.
4. **Mechanically simple, warmly presented.** There's one verb (E / the action button). The charm comes from the setting, people, food, light and sound.

## Core loop

```
Title page ("Puja Passport · You are in Anandapur" + four rules) → Start the Night (6:00 PM)
  → camera swoops down → optional tips → explore streets (minimap, compass, gold arrow near gates)
  → enter a pandal (discovery banner in Bengali · Devanagari · English) → see the protima
  → ring its bell → stamp → passport n/10 (and, if you like, enjoy the pandal's activity)
  → on the way: eat fuchka / rolls / chowmein / cha …, dance at DJ spots, sit, pranam, selfies
  → the clock runs 6 PM → 4 AM over 45 real minutes (paused in menus or a hidden tab)
  → 10/10 = success (it can't be taken back) → "Finish the Night" at Sunrise Ghat, or automatically at 4 AM
  → sunrise finale → keep exploring
If 4 AM arrives with fewer than 10 stamps: "The Pujo night has come to an end…" → Retry · Sightseeing (no clock) · Main menu
```

Rules:
- All ten pandals are open from the start, and you can visit them in any order.
- Entering the grounds only *discovers* a pandal. Ringing **its bell** (every pandal has one near its entrance) gives the stamp straight away — there is no prerequisite. Each pandal's activity is an optional extra you can enjoy before or after.
- Stamps never duplicate. Progress, the clock, position, outfit and settings are saved locally.

## World: five districts

| District | Bengali | Character | Pandals |
|---|---|---|---|
| Bonedi Para | বনেদি পাড়া | Arcaded mansions, green shutters, cast-iron balconies, rowaks | Rajbarir Pujo, Matir Taan, Debaloy |
| Alok Pally | আলোক পল্লী | Chandannagar-style light arches across the lanes | Alor Thikana, Nakshatralok |
| Mela Bazaar | মেলা বাজার | Staffed shopfronts with hand-painted signs, food stalls, the tram line | Dhaker Taale, Smritir Shohor |
| Notun Nagar | নতুন নগর | Pastel apartment blocks, palms, a park | Aranyer Ahoban, Neel Swapno |
| Nodi Ghat | নদী ঘাট | Ghat steps with priests' umbrellas, shrines, boats, floating diyas, a DJ podium over the steps | Nodir Opare (out on the river), Sunrise Ghat (finale) |

Building flanks are fully detailed: cornices, quoins, louvred windows, vents, bare brick, wall ads and side balconies.

## The ten pandals and their protimas

| # | Pandal | Meaning | Theme | Protima style | Optional activity |
|---|---|---|---|---|---|
| 1 | Rajbarir Pujo · রাজবাড়ির পুজো | The Royal Courtyard | a traditional Pujo in an old zamindar mansion | **Sabeki** Kumartuli: golden face, red and gold, one shared frame | the courtyard bell (also its stamp) |
| 2 | Alor Thikana · আলোর ঠিকানা | Where Light Lives | thousands of lamps, glowing arches | **Gilded**: an all-gold image | wake three light sculptures |
| 3 | Matir Taan · মাটির টান | The Call of the Earth | rural Bengal: terracotta, clay, folk painting | **Terracotta**: unpainted Bankura clay | look at patachitra, terracotta and dokra |
| 4 | Aranyer Ahoban · অরণ্যের আহ্বান | Call of the Forest | an enchanted forest, a tree of life | **Eco**: jute, wood and leaf tones | light three lanterns around the tree of life |
| 5 | Dhaker Taale · ঢাকের তালে | To the Beat of the Dhak | Bengali music, the dhak and dance | **Patachitra**: bold folk colours | tap the dhak rhythm (skippable) |
| 6 | Neel Swapno · নীল স্বপ্ন | The Blue Dream | an ocean dream of suspended fish | **Sea**: teal and blue with pearl ornaments | find the pearl in the clam |
| 7 | Smritir Shohor · স্মৃতির শহর | City of Memories | old Kolkata: trams, bookshops, streets | **Daker saaj**: silver tinsel ornaments | match postcards to scenes (a still miniature tram) |
| 8 | Nodir Opare · নদীর ওপারে | Across the River | out on the river, reached by a footbridge | **Pastel alada chala**: each deity in her own frame | float a clay lamp on the river |
| 9 | Nakshatralok · নক্ষত্রলোক | Realm of Stars | constellations, planets, a moonlit dome | **Akash**: indigo and silver | light the Saptarshi, Kalpurush and Dhruvatara |
| 10 | Debaloy · দেবালয় | Abode of the Divine | a temple: carved architecture, a ceremonial entrance | **Regal**: deep red and heavy gold, a larger image | blow the shankha, light the deepastambha, offer pushpanjali (in order) |

**Nodir Opare** stands in the river on a plank deck carried by wooden piles, level with the sixth ghat
step and about 0.9 m above the water. A railed footbridge on piers runs out to it under a marigold
toran; the deck is railed all round, two country boats are moored alongside, and lamps are floated
from its far rail.

Every tableau is the full ekchala:
- Durga, ten-armed, each hand bearing a weapon. Her right foot is on the horse-faced lion, her left leg on Mahishasura, and the trishul is in his chest.
- Lakshmi with lotus, conch and owl; Ganesh with four arms, the mouse and Kola Bou; Saraswati with veena and swan; Kartik with bow, arrow and peacock.
- Protima faces follow Kumartuli conventions: long-tailed eyes, chandan dots, and a nath.

## Landmarks

- Bronze statues on stone pedestals in small railed gardens, garlanded with marigolds and with trilingual nameplates: **Netaji Subhas Chandra Bose** saluting (Mela Bazaar) and in the "Dilli Chalo" pose (Notun Nagar), **Swami Vivekananda** with folded arms (Bonedi Para) and **Rabindranath Tagore** holding a book (Alok Pally).
- An aat-chala **Shiva mandir** of terracotta brick on the north edge, with its courtyard, tulsi mancha and pukur.
- The city is built out to the coast, so no edge stands bare.

## People, food and things to do

- **The crowd:** about 300 people. They wear saris, salwar kameez, kurtas, shirts, T-shirts and jeans, and frocks. Families walk the pavements and spill onto the road. There are shopkeepers behind every open shop, vendors with queues, dhakis, dhunuchi dancers and DJ-spot dancers. The crowd builds from 6 PM, peaks between about 7:30 PM and 1 AM, and thins after 2 AM.
- **Traffic:** yellow Ambassador taxis, autos, cycle-rickshaws, motorbikes and a tram on rails. They brake for people and honk if you stand in the way.
- **Food:** fuchka, chowmein, kathi rolls, cha, jhalmuri and mishti. Each is a modelled stall with a trilingual board. Pressing E makes you eat or drink, with the food in your hand.
- **Other actions:** dance at any of the 12 DJ spots (E again asks for the next song), join the dhunuchi naach, sit on benches, offer pranam at the protima, and take selfies at photo spots.
- **Aarti:** at about 7:30–8:15 PM (sandhya aarti) and 11:45 PM–12:30 AM, a purohit appears before every protima waving a five-flamed lamp. Bells and conch ring at all ten pandals, and you can join in with folded hands.
- **Five optional discoveries:** the artisans' lane, a rooftop cat, a gramophone, a pillar box and a ferry boat.

## Sound

- **Dhak:** a recording that fades out within about 30 m of each pandal.
- **DJ spots:** full volume within 4 m and silent by 15 m. While you're in a DJ zone, everything else ducks.
- **Everything else** is synthesised: the crowd, the river, bells, conch, horns, footsteps and the UI.

## Atmosphere

The sky follows the clock: dusk at 6 PM → early night → deep festive night → pre-dawn → the sunrise
finale. Lighting stays vivid throughout. Lights are deliberately restrained, with no blown-out glare.

## Finale

At 10/10 an invitation leads to **Sunrise Ghat**. "Finish the Night" there, or the clock reaching
4 AM, starts a crane shot over the river as the sun rises, a conch sounds and people wave and clap.
The finale card reads *Shubho Sharodiya*, shows your stamps, and lets you keep exploring in morning
light. This is a symbolic dawn after a night of pandal hopping, **not** a Dashami immersion.

## Explicit design decisions

- **Tiny planet, flat gameplay.** All logic runs on a flat XZ plane; only rendering wraps onto a sphere.
- **A bell for the stamp.** Ringing a visitors' bell at the entrance is something every visitor may do; it's never part of the worship at the bedi.
- **A forgiving clock.** It pauses whenever you're not playing, failure offers sightseeing with no clock, and success can't be revoked.
- **Trilingual titles.** Pandal and food-stall names appear in Bengali, then Devanagari, then English, at the same size and in the same font family. Shop signboards stay Bengali and English, as they are in Kolkata.
- **Commercial songs are personal.** They play only from your local folder, and `build:public` never ships them.
