# Research: Croatian Bela for 3 players (utroje) and 2 players (udvoje)

Status: research notes, gathered 2026-10-09. These notes are input for adding 3- and 2-player options to the 4-player engine described in [`bela.md`](./bela.md). Nothing here is implemented yet.

## How to read this

- **[S1]**, **[S2]** and so on point to the [Sources](#sources) list. Quotes keep the source's original language, followed by an English translation.
- **Confidence** says how many independent sources agree. Several Croatian sites copy the same text (see [Source lineage](#source-lineage)), so they count as **one** source, not several.
- `hr.wikipedia.org/wiki/Bela_(kartaška_igra)` does not exist. The Croatian Wikipedia article is titled **"Belot"** ([S1]).

### Source lineage

Treat these as one source family when counting agreement:

- **Family A: Croatian Wikipedia text.** The source is [S1] hr.wikipedia "Belot", which cites Ančica Sečan, *Belot iliti Bela* (sunceko.net; that page now shows only a template). The same text, nearly word for word, appears at [S2] licitum (2011 forum copy), [S3] favorite-games.com, [S4] igrajkarte.com (Serbian ekavian copy), [S5] belaklub.com (a paraphrase), enciklopedija.cc, and the idoc.pub/kupdf "Bela Pravila" PDF ([S7]).
- **Family A′: Serbian Wikipedia.** [S6] sr.wikipedia "Belot (igra)" grew from the same text, but its 3- and 2-player rules were edited and differ in places. The idoc.pub PDF [S7] mixes A and A′.
- **Independent sources:**
  - [S8] Marko Petran's English write-up of Croatian Belot. pagat.com links to it as "Croatian Belot".
  - [S9] igra-razbibriga blog.
  - [S10] arz.hr.
  - [S11] dalmacijaportal.hr.
- **Related games, not Croatian Bela:**
  - [S12] pagat "Clobyosh / Bela", the Jewish/Scottish Klaberjass.
  - [S13] pagat "Belote Découverte", French. [S14] indeks.hr is a Croatian translation of it.
  - These are useful for comparing variants, but they are not authorities on Croatian rules.
- **Excluded as unreliable:**
  - net.hr "Bela u troje" ([X1]) describes 5-card hands, bidding "at least 81 points" and "six rounds". It contradicts every other source and reads like generated filler.
  - onlinekazinosrbija.rs ([X2]) is a generic casino SEO page with no concrete rules.

---

## Rules common to both modes (unchanged from 4 players)

Every source family says the core of the game is the same whatever the player count:

> "Svaka se partija belota (bez obzira na broj igrača) sastoji od dijeljenja, određivanja aduta, zvanja, igranja i zbrajanja bodova." — [S1]
> *Every game of belot (regardless of the number of players) consists of dealing, choosing trumps, declarations, play and scoring.*

- **Deck: 32 cards** (7–A in four suits), the same deck as 4-player ([S1], [S8], [S9]). No Croatian source removes the 7s. The 28-card deck without 7s appears only in the Clobyosh 3-player variant ([S12]), where it is "some prefer".
- **Card values and ranking** are as in `bela.md` (J 20, 9 14, … in trumps). [S1]'s card-value table is not split by player count.
- **Play direction** is counter-clockwise, and the player to the dealer's right speaks and leads first ([S1]; Međimurje plays the other direction).
- **Follow, beat (iber) and trump obligations** are the same. [S1]'s "Igranje" section is general. No Croatian source gives different play obligations for 2 or 3 players.
- **Declaration values** are the same: 20/50/100 sequences, 100/150/200 four of a kind, bela 20, and belot (8 in a row) wins the match.
- **Last trick +10**: "Igrač koji nosi zadnji štih dobiva još dodatnih 10 bodova." ([S1])
- **Štiglja +90**: "Ako igrač ili kartaški par pokupe sve štihove, dobivaju još dodatnih 90 bodova." ([S1]) The wording says *igrač* (player) and is not limited to pairs.
- **A declaration (and bela) needs at least one trick to count**: "Igraču se ili kartaškom paru zvanje (uključujući i belu) ne priznaje ako nisu pokupili barem jedan štih." ([S1]; [S8] uses the same idea)
- **Pad is written as a dash**: "Pad se bilježi crticom, ne nulom." ([S1], in both the 2- and 3-player scoring sections)
- **Belot instantly wins, with the per-mode target**:
  > "...igrač koji ga je dobio istog trena pobjeđuje ... (kao da odjednom osvoji 501 bod u beli udvoje, 701 bod u beli utroje ili 1001 bod u beli učetvero)." — [S1]
  > *...the player who gets it wins instantly ... (as if he scored 501 at once in 2-player bela, 701 in 3-player, or 1001 in 4-player).*

---

## 3 players: bela utroje

### 1. Deck

32 cards, all of them dealt and all in play (high confidence: [S1], [S8], [S9]).

> "Kod igre u troje, u igri su sve karte..." — [S9] *In the 3-player game all the cards are in play...*
> "Like in a four player game, all cards are used, so the total number of points in a round is 162 [+ declaration(s)]." — [S8]

### 2. Deal

The main rule is **3 + 3 cards in hand, 4 talon cards each, and the 2 leftover cards to the caller, who discards 2**, so everyone plays 10 cards (10 tricks). Confidence is high: [S1] (family A), [S8], [S9] and [S10] are four independent sources.

> "Svaki igrač dobije tri karte okrenute licem prema dolje, zatim još tri karte (ukupno šest), a onda još četiri karte u talonu, koje se posebno odvoje od prvih šest karata. Dvije preostale karte namijenjene su za prvog igrača s djeliteljeve desne strane (on je prvi na redu). Igrači podižu prvih šest podijeljenih karata i prvi igrač s djeliteljeve desne mora zvati aduta. Kada je adut određen, igrači podižu talon (igrač koji je zvao podiže šest karata, a ostali četiri). Tada igrač koji je zvao, tj. odredio adut, izabire iz svojih karata dvije koje će odbaciti, tako da sva trojica sada imaju jednak broj karata u rukama (deset). Odbačene karte pripadaju igraču koji je zvao adut. On ih odlaže među svoje štihove." — [S1]
> *Each player gets three cards face down, then three more (six in all), then four talon cards kept separate from the first six. The two remaining cards are meant for the first player to the dealer's right (he is first to act). Players pick up their first six cards, and the first player to the dealer's right must call trumps. Once trumps are set, players pick up the talon (the caller picks up six cards, the others four). The caller then chooses two cards from his hand to discard, so that all three hold the same number of cards (ten). The discarded cards belong to the caller, who puts them among his tricks.*

> "...dijele dva puta po tri, jednom po četiri i preostale dvije karte daju se prvom igraču koji mora odabrati adut na prvih šest dobivenih karata, preostale karte uzima tek nakon biranja aduta, nakon čega mora odbaciti dvije karte koje su višak." — [S9]
> *...dealt twice by three, once by four, and the remaining two go to the first player, who must choose trumps on his first six cards. He takes the rest only after choosing trumps, then must discard the two surplus cards.*

> "Players are first dealt three cards then another three. The player first to play must choose trumps. When he chooses the trumps, each player is dealt another four cards. There are two cards left. Those two cards are dealt to the player who chose trumps. [...] Therefore, the player who chose trumps discards two cards from his hand to his tricks." — [S8]

[S10] says the same: "preostale dvije karte idu igraču koji je prvi s desne strane djelitelja, te taj igrač mora zvati aduta. [...] igrač s viškom karata odbacuje dvije karte [...] i na kraju se zbraju tom igraču." (*the two remaining cards go to the first player right of the dealer, who must call trumps [...] the player with surplus cards discards two [...] and at the end they are counted to that player.*)

Implementation notes:

- **Discards count for the caller.** Their card points go into the caller's pile. [S1] says "Odbačene karte pripadaju igraču koji je zvao adut", and [S10] and [S8] agree. The 162 total is therefore unchanged.
- **Whether a trump may be discarded** is not stated by any rules source. A forum.hr thread "Bela u troje" ([X3], t=625064) reportedly argues both ways, according to a search-result summary; the page could not be fetched (403).
- **Declaring after the discard.** [S8] says declarations happen after the discard: "After the player who chose trumps discarded his two additional cards, players declare their declarations. Yes, the player must be careful not to discard cards that would form a declaration."
- **Variant (A′), where the 2 extra cards sit in the middle and go to whoever calls.** See the next section and the *Variants* list.

### 3. Trump calling

**Main rule: the first player (dealer's right) must call, with no passing.** He chooses from his first 6 cards. Confidence is high: [S1], [S8], [S9] and [S10] (four sources), with [S3] adding "Nema pravo reći dalje" (*he has no right to say pass*).

- [S8]: "The player first to play must choose trumps."
- [S1] and [S10]: "prvi igrač s djeliteljeve desne mora zvati aduta" (*the first player to the dealer's right must call trumps*).

So in the main rule there is no bidding round in 3-player. The forced caller is fixed by seat, and it rotates as the deal rotates.

**Variant (A′): passing allowed, and the dealer is forced (mus).**

> "Igrači podižu prvih šest podeljenih karata i prvi igrač s deliteljeve desne zove Aduta ili govori „dalje". Ako oba igrača kažu dalje i izbor aduta dođe do delitelja onda on više nema pravo reći dalje. Mora izabrati aduta." — [S6] (the same text is in [S7])
> *Players pick up their first six cards, and the first player to the dealer's right calls trumps or says "pass". If both players pass and the choice reaches the dealer, he may no longer pass. He must choose trumps.*

In this variant the 2 extra cards are "dve u sredini koje su namenjene za igrača koji je zvao Aduta" (*two in the middle meant for whoever called trumps*) ([S6]).

**Variant (A′), turn-up card:**

> "Postoji i opcija igranja u troje kada se umjesto 2 karte na kraju koje se daju prvome, jedna okrene i služi za određivanje aduta kao u dvoje. Onaj koji uzme aduta ne mora imati više u zbroju protiv druge dvojice nego više od svakoga ponaosob." — [S3], [S6], [S7]
> *There is also a 3-player option where, instead of the 2 cards given to the first player at the end, one card is turned up and used to set trumps as in the 2-player game. Whoever takes trumps then need not have more than the other two combined, only more than each of them individually.*

None of these sources says what happens to the other leftover card. In pagat's Clobyosh ([S12]), the 3-player game deals 9 cards each and the turn-up is the only card out of play.

### 4. Teams

Everyone scores individually. **For the hand, the caller plays alone against a temporary partnership of the other two.** Confidence is high: [S1], [S8] and [S9].

- [S8]: "The player who chose trumps does all he can to pass while the other two players temporarily 'team up' to prevent him. [...] the 'team mates' are going to give each other valuable cards so the sum of the points in their tricks is bigger than the number of points in the tricks of their 'common enemy'."
- [S9]: "U ovoj igri u troje igra se protiv onog igrača koji je odabrao adut ili eventualno protiv onog koji ima najviše poena u konačnom zbiru." (*In 3-player you play against the player who chose trumps, or possibly against whoever has the most points in the running total.*)
- [S1]: "Kada se bela igra utroje, igrač koji zove adut treba skupiti više od zbroja bodova ostalih dvaju igrača." (*In 3-player bela, the caller must collect more than the sum of the other two players' points.*)

The partnership exists only to decide pass or fall. **Each opponent still writes his own points** (see Scoring).

### 5. Play obligations

**No Croatian source states a 3-player difference.** The general rules in [S1] apply: follow suit, play higher (iber), trump when void, and no iber obligation in the led suit once the trick has been trumped.

pagat's Clobyosh ([S12]) clarifies one 3-player case:

> "where a lead of a plain suit has been trumped by the second player to a trick and the third to play also has no cards in the suit led, then the third player must still overtrump if possible. If he cannot overtrump he must play a lower trump, and only if he is out of trump may he discard freely."

This matches what `legal.ts` already does for 4 players. The overtrump obligation applies even against the temporary "partner", because no partner exemption exists in any source.

### 6. Declarations and bela

Declarations are made at the start of play, after the caller's discard ([S8]). The same values apply, and a declaration needs a trick to count ([S1], [S8]).

**Who scores declarations** has only one explicit 3-player source, [S8]. The opponents are treated as a team when deciding *which side* scores, but each player keeps only his own declarations:

> "If a player who didn't choose trumps has a higher ranking declaration than the player who chose the trumps, his 'team mate' is awarded his own declaration even if the rank of the declaration is lower than that of the player who chose trumps. For example: Player 1 has A-K-Q-J, Player 2 has 4 Tenners, Player 3 has 9-8-7. Player 1 isn't awarded his declaration because Player 2 has the highest ranking declaration, but Player 3 is awarded his declaration because his 'team mate' has the highest ranking declaration. Players 2 and 3 don't share declarations. They are each awarded their declaration respectively (in our case Player 2 would be awarded 100 points and Player 3 twenty points)." — [S8]

[S8] also shows that an opponent who wins no trick loses his declaration, even though it was the declaration that decided which side scores declarations:

> "...player 2 did not manage to win a trick and, thus, didn't confirm his declaration. [...] Player 2 is awarded nothing [...] so his square (100 pts) went to hell. The total sum of points in the round was 202 (162 pts + 20 points from the declaration of Player 3 + 20 pts from Bela)" — [S8]

In other words, P2's unconfirmed 100 still blocked P1's declaration, but it was removed from the hand total.

[S1]'s general rule, "Zvanje se priznaje samo onom kartaškom paru koji ima najjače (najvrednije) zvanje (iznimka je bela)" (*declarations count only for the pair with the strongest declaration, bela excepted*), is written for pairs and does not address 3 players.

**Bela** in 3-player gets no special mention. It is scored by whoever holds trump K+Q, including the caller, as in [S8]'s example ("He also had the King and Queen of trumps, so he declared Bela being awarded another 20 points").

### 7. Scoring

**Hand total** = 162 + every counted declaration + bela ([S1], [S8]). Last trick +10 is part of the 162.

**Pass condition.** The caller passes only with **more than the two opponents combined**, i.e. more than half the total. Confidence is high: [S1], [S8] and [S9].

- [S1]: "Ako je igrač koji je zvao adut prošao, tj. skupio pola+1 od igre, svakom od troje igrača se pišu osvojeni bodovi koje su osvojili u pokupljenim štihovima." (*If the caller passed, i.e. collected half+1 of the game, each of the three players is credited with the points won in his own tricks.*)
- [S8] gives three worked examples (no declarations):
  - Caller 60, opponents 71 + 22 = 93 > 80: fall. Opponents write 71 and 22, and the caller writes nothing.
  - Caller 82, opponents 60 + 20 = 80: pass. All three write their own points.
  - Caller 103, opponents 17 + 42 = 59: pass. All three write their own points.

**Pass:** each of the three players writes his own points (trick points plus his own counted declarations and bela) ([S1], [S8], [S9]).

**Pad (fall): who receives the points.** This is the biggest disagreement.

| Variant | What happens to the caller's points | Sources |
|---|---|---|
| **A: the points vanish** (main Croatian rule) | Caller writes "–". Each opponent writes only what he took. The caller's points go to nobody. | [S1], [S2], [S3], [S4], [S5] (family A); [S8]; [S9]. That is 3 independent sources |
| B: the higher opponent takes them | Caller writes "–". The opponent who took more adds the caller's points to his own. The other opponent writes only his own. | [S6] (sr.wikipedia); pagat Clobyosh [S12] (non-Croatian) |
| C: both opponents take them | Each opponent adds the caller's points to his own. | [S12], listed as "Some play" (non-Croatian) |

- [S1]: "Ako je igrač koji je zvao adut pao, on ne osvaja ništa. Ostala dva igrača osvajaju onoliko koliko su pokupili u štihovima." (*If the caller fell he wins nothing. The other two win as much as they collected in tricks.*)
- [S8]: "When the player falls he isn't awarded the points he won in he round, but neither are his opponents."
- [S9]: "Ako igrač koji je odabrao adut ne osvoji pola od igre plus jedan poen njegovi se poeni ne upisuju preostaloj dvojici igrača." (*If the caller does not win half the game plus one, his points are not written to the other two.*)
- [S6]: "Ako je igrač koji je zvao adut pao, on ne osvaja ništa. Od ostala dva igrača igrač koji je sakupio više štihova prisvaja i poene igrača koji je pao." (*If the caller fell he wins nothing. Of the other two, the one who collected more takes the fallen player's points as well.*)
- [S12]: "the taker is bate and opponent with the higher score wins the bate player's points in addition to his own. The lower opponent just scores the points he took."

**Exact half (visi).** No 3-player source mentions *visi*. The wording ("više od zbroja", "pola+1") makes an exact tie a **fall**. [S8]'s examples treat opponents at exactly 80 as a *pass*, but only because the caller then has 82, which is not a tie.

**Štiglja.** No 3-player-specific statement exists. [S1]'s general wording ("igrač ili kartaški par pokupe sve štihove … 90") gives +90 to a *player* who takes all tricks. Whether the two opponents *together* taking all tricks counts as a štiglja is not covered. [S8]'s "All tricks" section discusses only the case where a player wins no tricks.

**Match target: 701.** Confidence is high: [S1] family, [S5], [S8] and [S9].

> "Bodovna granica (bela utroje): Pobjeđuje onaj koji prvi skupi 701 bod." — [S1] *Target (3-player bela): the first to collect 701 points wins.*
> "Threshold in a three player game is 701 points." — [S8]
> "Igra traje dok jedan od igrača ne osvoji 701 poen." — [S9]

The only dissent is [S10]: "a kada se igra udvoje ili u troje partija traje do 501 zbrojenih bodova" (*when played by two or three, the game lasts to 501 points*).

**End of match.** [S1] describes "igrati na dosta" (claim out mid-hand once the target is reached, but only by a player who has just won a trick) versus "na prolaz" (the last hand is scored normally). It says "Prema uobičajenim pravilima igra se na 'dosta'", and that the *caller* always plays "na prolaz". Comments on [S4] show 3-player tables arguing over exactly this: a non-caller claiming 701 mid-hand, and two players over the target. The engine currently plays everything out and compares totals (see `bela.md`), which is the "na prolaz" behaviour.

### 8. 3-player variants (summary)

| Topic | Main rule | Variant(s) |
|---|---|---|
| Who calls | First player right of dealer **must** call ([S1], [S3], [S8], [S9], [S10]) | Pass allowed, dealer mus ([S6], [S7]) |
| Extra 2 cards | Pre-assigned to the first player ([S1], [S8], [S9], [S10]) | In the middle, go to whoever calls ([S6], [S7]); or one card turned up as a trump proposal ([S3], [S6], [S7]) |
| Pass condition | More than both opponents combined ([S1], [S8], [S9]) | More than each opponent individually (turn-up variant in [S3], [S6], [S7]; Clobyosh [S12]) |
| Pad | Caller's points vanish ([S1], [S8], [S9]) | The higher opponent takes them ([S6], [S12]); both opponents take them ([S12]) |
| Target | 701 ([S1], [S5], [S8], [S9]) | 501 ([S10]) |
| Deck | 32 | 28 without 7s, 9 cards each (Clobyosh only, [S12]) |

---

## 2 players: bela udvoje

There are two distinct Croatian 2-player games:

- **"Zatvorena" (closed) bela udvoje**, the standard one: hands are held, 10 cards each, 20 of the 32 cards are in play.
- **"Otvoreni belot"** (open belot): 16 cards each, laid in rows, half face down.

> "Belot dijelimo na dvije osnovne verzije, otvoreni i zatvoreni. Otvoreni se igra isključivo u dvoje, s 8 karata poslaganih ispred svakog igrača, ispod kojih se nalazi još 8 skrivenih. Zatvorena bela je ona klasična, s kartama u rukama svakog igrača, a kada se igra u dvoje igrači koriste samo po deset karata, dok isto vrijedi i za igru u troje." — [S11]
> *We divide belot into two basic versions, open and closed. Open is played only by two, with 8 cards laid out in front of each player and another 8 hidden beneath them. Closed bela is the classic one, with cards held in each player's hand; when played by two the players use only ten cards each, and the same holds for three.*

The main section below covers closed bela udvoje. Open belot is summarised after it.

### 1. Deck

The full 32-card deck is shuffled, but **only 20 cards are in play**: 10 per player. The turned-up card and the 11 undealt cards are out of play. Confidence is high: [S1], [S8], [S9] and [S11].

> "Then he puts the remaining cards face-up on top of the face-up card, signalling that the remainder of the deck isn't used in the round (only 20 out of 32 cards are used in a two player game)." — [S8]

> "...tako da svaki igrač ima po deset karata, a one ostale ostaju zajedno u snopu do sljedećeg dijelenja, sa donjom kartom okrenutom licem prema gore." — [S9]
> *...so each player has ten cards, and the rest stay together in a pile until the next deal, with the bottom card face up.*

Because only 20 cards are in play, **the hand total is not fixed at 162**:

> "Since 12 cards of the deck aren't used in a two player game [...] passing can't be determined from the total sum of points in a clean game. The number simply varies from round to round." — [S8]

### 2. Deal

The deal is **3 + 3 to each player (non-dealer first), then one card turned face up, then 4 talon cards each, kept apart**. The rest of the pack is laid crosswise on the turned-up card so the card stays visible. Confidence is high: [S1], [S8] and [S9].

> "Svaki igrač dobije po tri karte licem okrenute prema dolje, potom sljedeće tri karte (dakle sveukupno šest karata). Djelitelj zatim okrene sljedeću kartu licem prema gore. Tada dijeli još dodatne četiri karte svojem suigraču i sebi (te se karte nazivaju talon i one se ne smiju miješati s prvih šest podijeljenih karata, nego njih valja odvojiti posebno). Ostatak se karata stavlja vodoravno na onu kartu koja je prije stavljena licem prema gore, ali tako da se vidi o kojoj se karti radi." — [S1]
> *Each player gets three cards face down, then three more (six in all). The dealer then turns the next card face up. He then deals four more cards to his opponent and himself (these are called the talon and must not be mixed with the first six, but kept separate). The rest of the pack is laid crosswise on the face-up card, so that you can see which card it is.*

[S8] gives the same order: opponent 3, dealer 3, opponent 3, dealer 3, then the turn-up, then 4 + 4.

There is **no dummy or face-up table hand** in closed bela udvoje. The only visible card is the turn-up. [S8] says the undealt stack is also placed face up ("both the face-up card and the remaining deck are visible"). [S1] does not say whether the stack is face up or face down; it only requires that the turn-up stay visible.

**Variant (A′), "two in the middle":** [S6] has the dealer also put "dve u sredinu, koje uzima igrač koji je zvao Aduta" (*two in the middle, which the caller takes*). The caller takes them after picking up the talon and discards two ("izbacuje dve karte i uzima dve karte sa sredine talona. Odbačene karte pripadaju igraču koji je zvao adut"), the same mechanism as in 3-player.

### 3. Trump calling

The bidding has two rounds, the dealer is forced at the end (mus), and there is a **7-of-trumps exchange**. Confidence is high: [S1], [S8] and [S9], plus [S5] for the exchange.

Round 1 is on the turned-up suit: the non-dealer first, then the dealer. In round 2 the non-dealer may name any *other* suit or pass. If he passes, **the dealer must name one of the three other suits**:

> "Prvih se šest karata podiže i pristupa se određivanju aduta. Prednost ima onaj igrač koji nije dijelio. [...] igrač odlučuje hoće li zvati, odnosno odrediti da adut bude ona boja koja je na karti okrenutoj licem prema gore [...] ili će reći dalje. U slučaju da kaže „dalje", igrač koji je dijelio dobiva istu mogućnost koju može prihvatiti ili odbiti. Ako oba igrača odbiju [...], pravo određivanja aduta ponovno dobiva igrač koji nije dijelio. On ponovno može izabrati adut, ali da nije ona boja koju je prvi put odbio [...], ili može po drugi puta reći dalje. Ovaj put djelitelj mora odrediti adut između tri preostale boje (bilo koju osim prvotno odbijene). Kada je adut određen, oba igrača podižu preostale četiri karte (talon), tako da svaki igrač u rukama ima ukupno deset karata." — [S1]
> *The first six cards are picked up and trumps are chosen. The non-dealer has priority. [...] he decides whether to call, i.e. make the suit of the face-up card trumps [...] or say "pass". If he passes, the dealer gets the same option, which he may accept or refuse. If both refuse [...], the right to choose returns to the non-dealer. He may choose a trump again, but not the suit he first refused [...], or pass a second time. This time the dealer must choose trumps among the three remaining suits (any except the one first refused). Once trumps are set, both players pick up the remaining four cards (the talon), so each holds ten cards in all.*

[S8] says the same and names the forced dealer "mussed". [S9] agrees: "gdje djelitelj mora odabrati boju u koju se igra" (*where the dealer must choose the suit to play*).

The **7-of-trumps exchange** is confirmed by [S1], [S5] and [S8]. [S8] and [S12] both limit it to the case where the turned-up suit becomes trump:

> "U igri udvoje ako jedan od igrača dobije sedmicu u adutu u prvih šest karata, on može zamijeniti tu sedmicu za kartu koja je okrenuta licem prema gore." — [S1]
> *In 2-player, if a player gets the seven of trumps in his first six cards, he may exchange it for the face-up card.*
> "If a player accepted the suit of the face-up card, a player who has Seven of the same suit in first six cards can replace it with the face-up card. [...] If another suit was chosen and a player has the Seven of Spades, he can go screw himself." — [S8]

Either player may exchange, not only the caller. The 7 must be among the **first six** cards, not the talon ([S1], [S8]). [S12] (Clobyosh) allows the exchange only after the full deal and from any card in hand, but that is a different game.

**Clobyosh contrast** ([S12], not Croatian): the dealer may also pass in round 2, which leads to a redeal. Croatian sources force the dealer.

### 4. Teams

None. The game is one against one ([S1], [S8]).

### 5. Play obligations

**No Croatian source states a 2-player difference.** The general rules in [S1] apply: follow, iber, trump when void, overtrump. With two players, every trick is just two cards.

### 6. Declarations and bela

The usual rule applies: the player with the best declaration scores all of his declarations, and the other player scores none. Bela is separate.

> "Nothing special about declarations here since there are only two players. The declaration(s) of the player with the highest ranking declaration are awarded." — [S8]

A declaration still needs a trick to count. In 2-player, a player with no tricks means the opponent took all of them:

> "A player having no tricks means the other player has won all tricks. Basically, if you don't manage to confirm your declaration, it is awarded to your opponent." — [S8]

This is ambiguous. It may mean the opponent gets the points through pad or štiglja, not that the declaration itself transfers. See the open questions.

Belot (8 in a row, instant win) is still listed by [S1] for 2-player ("501 bod u beli udvoje").

### 7. Scoring

**Pass condition:** the caller passes with **more points than the opponent**. Confidence is high: [S1], [S8] and [S9]. Because the total varies from hand to hand, the rule is phrased as a comparison, not as "82":

> "Ako je igrač koji je zvao adut prošao, tj. skupio više bodova od protivnika, obojici se igrača piše zbroj štihova koji su osvojili. Ako je igrač koji je zvao adut pao, tj. nije skupio više bodova od protivnika, protivnički igrač osvaja sve njegove bodove + svoje bodove. Protivnikov pad bilježi se crticom, ne nulom." — [S1]
> *If the caller passed, i.e. collected more points than the opponent, both players are credited with their tricks. If the caller fell, i.e. did not collect more than the opponent, the opponent wins all of the caller's points plus his own. The fall is written as a dash, not a zero.*

> "The player who chose trumps must win more points than his opponent to pass. If he doesn't, he falls and all the points he won in the round are awarded to his opponent." — [S8]

> "Ako igrač koji je odabrao adut ne osvoji više poena od drugog igrača njegovi se poeni upisuju drugom igraču." — [S9]
> *If the caller doesn't win more points than the other player, his points are written to the other player.*

- **Pad** works as in 4-player: the opponent takes the whole hand.
- **An exact tie is a fall** ("nije skupio više"). No source mentions *visi* for 2 players.
- **Last trick +10 and štiglja +90** come from the general rules in [S1]. Hands have 10 tricks.
- **Hand total** = card points of the 20 cards in play + 10 (last trick) + declarations + bela. The minimum is 10 + declarations; the maximum is 162 + declarations.

**Match target: 501.** Confidence is high: [S1] family, [S5], [S8], [S9] and [S10], i.e. four independent sources plus pagat Clobyosh [S12].

> "Bodovna granica (bela udvoje): Pobjeđuje onaj koji prvi skupi 501 bod." — [S1]
> "Threshold in a two player game is 501 points." — [S8]
> "Igra traje dok jedan od igrača ne osvoji 501 poen." — [S9]

### 8. Open belot (otvoreni belot), a separate 2-player game

These sources are thinner and less reliable. Implement this only as a separate mode, if at all.

**Layout.** Each player gets 16 cards in two rows of 4: face-down cards, each covered by a face-up card. All 32 cards are in play, so there are 16 tricks. When a face-up card is played, the card beneath it is turned up. Sources: [S8], [S11], [S13]/[S14].

> "The dealer first deals his opponent a row of four face-down cards. Then he deals a row of four face-down cards to himself. Then another row [...] Then he deals his opponent a row of four face-up cards which he places on top of the first four face-down cards. [...]" — [S8]

The two source groups differ on everything after the layout:

- **Trump.**
  - [S8] (Croatian): "Player 1 can choose the trumps or pass. If Player 1 passes, Player 2 (the dealer) is mussed and must choose the trumps."
  - [S13] (French Belote Découverte): the last face-up card dealt on the dealer's side proposes trumps, and there are two bidding rounds. "The taker does not, however, take the card indicating the trump suit. It continues to belong to the dealer."
- **Declarations.**
  - [S8]: both players score their own declarations, which must still be confirmed. A sequence extended during play adds only +20 per extension card.
  - [S13]/[S14]: "declarations and Belote-Rebelote do not count". [S14] says this must be agreed beforehand.
- **Iber (über).** [S8]: "The little sources I managed to find about Open Belot say über is not played (suit has to be followed though). However, we always play über".
- **Scoring.** Both groups: the caller must beat the opponent, total 162 (+ declarations), and pad gives everything to the opponent ([S8], [S13]).
- **Target.** No source gives one. Presumably 501, as in the closed 2-player game.

---

## Open questions and disagreements

1. **3p pad: where the caller's points go.** The main Croatian rule ([S1], [S8], [S9]) is that **they vanish**. sr.wikipedia ([S6]) gives them to the opponent with more points, which is also pagat's Clobyosh rule ([S12]). [S12] also lists "both opponents add them". Suggestion: default to "vanish" and offer the others as house-rule options.
2. **3p trump calling: forced first player or pass-then-mus.** The main rule ([S1], [S3], [S8], [S9], [S10]) is that the first player to the dealer's right must call. The A′ texts ([S6], [S7]) let him pass, and the dealer is then forced. In the A′ version, the 2 extra cards go to whoever calls.
3. **3p turn-up variant** ([S3], [S6], [S7]): one card is turned up to propose trumps, "as in 2-player", and the caller must beat **each** opponent individually. Not covered: the fate of the second leftover card, whether there are two rounds, and whether the 7-exchange exists.
4. **3p declarations.** Only [S8] states the rule. The opponents count as one side to decide *who* scores declarations, then each writes only his own, and each must confirm with a trick. An unconfirmed winning declaration still blocks the caller's, but its points drop out of the total. [S1] is silent for 3 players.
5. **3p štiglja.** The +90 applies to a player who takes all tricks. No source says whether the two opponents together taking all 10 tricks earns +90, or for whom.
6. **3p and 2p exact tie (visi).** No source mentions visi outside 4-player. The wording ("više od", "pola+1") implies a tie is a **fall**. A held ("visi") pot also has no defined recipient in 3-player.
7. **3p target.** 701 has broad agreement. Only arz.hr ([S10]) says 501.
8. **3p: may the caller discard a trump, or a card that forms a declaration?** No rules source says. A forum.hr thread disputes it (unfetched, 403). [S8] notes only that discarding can break your own declaration.
9. **2p undealt stack: face up or face down?** [S8] says face up (all 11 visible, which is extra information). [S9] and [S12] say only the bottom card is face up. [S1] says only that the turn-up stays visible.
10. **2p: is the 7-exchange only when the turn-up suit is chosen?** [S8] (and [S12]) say yes. [S1] is not explicit.
11. **2p "[declaration] is awarded to your opponent".** [S8]'s wording is ambiguous: does an unconfirmed declaration transfer to the opponent, or does the opponent simply win the hand with štiglja?
12. **2p "dve u sredinu" variant** ([S6]): 2 extra cards for the caller, who discards 2. No Croatian source outside sr.wiki has it.
13. **End of match ("na dosta" vs "na prolaz") and ties at the target.** In 3-player, two players can pass 701 in the same hand. [S1] prefers "na dosta" (claim on winning a trick). Comments on [S4] show 3-player tables disputing this.
14. **Play obligations in 2p and 3p.** No Croatian source restates them. The only explicit 3-player statement (overtrump by the third player) is pagat's Clobyosh ([S12]).
15. **Open belot** (separate 2p game): the trump procedure, declarations, iber and target all differ between [S8] and [S13]/[S14]. Sources are scarce. Even [S8] says "we're not even sure we've been playing it right".
16. **Bela Blok app.** A news article (mnovine.hr, [X4]) says the app supports 2-, 3- and 4-player games and "posebno je riješio problem igre u troje" (*specially solved the 3-player problem*). The page returned 403, and no help text could be read, so its 3-player scoring rules (especially pad) are unverified.

---

## Sources

| ID | Source | Language | Notes |
|---|---|---|---|
| S1 | Wikipedia, "Belot" — https://hr.wikipedia.org/wiki/Belot (rev. oldid=7230117, last edited 8 June 2025) | hr | Main Croatian reference. Cites Sečan, *Belot iliti Bela* (sunceko.net), TAKO.hr, Lupiga, Belot portal |
| S2 | "Bela Pravila za pocetnike", Licitum forum, 2011 — https://licitum.board-directory.net/t3-bela-pravila-za-pocetnike | hr | Copy of the S1 text |
| S3 | Favorite Games, "Pravila" (Belot) — https://www.favorite-games.com/htmlser/rules_belot4.php | hr | S1 text plus the 3p turn-up option and "Nema pravo reći dalje" |
| S4 | igrajkarte.com, "Belot (Bela) – pravila" — http://www.igrajkarte.com/blog/post/belot-bela-pravila/ | sr/hr | S1 text. The comments contain 3-player end-of-game disputes |
| S5 | belaklub.com, "Pravila Bele" — https://belaklub.com/pravila.html | hr | Paraphrase of S1. Target table 501/701/1001 |
| S6 | Wikipedia, "Belot (igra)" — https://sr.wikipedia.org/sr-el/Belot_(igra) | sr | Variants: 3p pass+mus, extra cards in the middle, pad to the higher opponent, 2p "dve u sredinu" |
| S7 | "Bela Pravila" PDF (idoc.pub) — https://idoc.pub/documents/bela-pravila-5143rg3k524j (same as https://eivanec.webmaster.com.hr/wp-content/uploads/2019/12/pravila-igre-bela-belot.pdf, which was blocked) | hr | Mix of S1 and S6 |
| S8 | Marko Petran, "Belot" (Croatian Belot, in English), 2016 — https://bedakjen.wordpress.com/2016/08/14/belot/ | en | Independent and detailed. Linked from pagat as "Croatian Belot" |
| S9 | Igra Razbibriga, "Bella pravila igre" — http://igra-razbibriga.blogspot.com/p/bella-pravila-igre.html | hr | Independent text |
| S10 | arz.hr, "Kako se igra bela" — https://www.arz.hr/kako-se-igra-bela/ | hr | Independent. Says 501 for both 2p and 3p |
| S11 | Dalmacija Portal, "Kako se igra bela? (Pravila, povijest, vrste i posebnosti)" — https://dalmacijaportal.hr/bela-povijest-pravila-i-najvece-posebnosti/ | hr | Open vs closed bela, 10 cards for 2p and 3p |
| S12 | pagat.com, "Clobyosh / Bela" — https://www.pagat.com/jass/bela.html | en | Klaberjass (Jewish/Scottish). Not Croatian. Used for comparison |
| S13 | pagat.com, "Belote" (incl. Belote Découverte) — https://www.pagat.com/jass/belote.html | en | French. Open 2-player game |
| S14 | indeks.hr, "Kako se igra bela? Pravila bele za 2 i 4 igrača" — https://indeks.hr/kako-se-igra-bela-pravila-bele-za-2-i-4-igraca/ | hr | Translation of S13 (French belote), not Croatian bela |
| X1 | net.hr, "Bela u troje – pravila" — https://net.hr/magazin/slobodno-vrijeme/bela-u-troje-pravila-za-kartasku-igru-bela-u-troje-ab32a412-d2cc-11ed-b8e3-4695913ed1ab | hr | **Excluded**: 5-card hands, point bidding. Contradicts every other source |
| X2 | onlinekazinosrbija.rs, "Kako se igra bela u 3" — https://onlinekazinosrbija.rs/kako-se-igra-bela-u-3/ | sr | **Excluded**: no concrete rules |
| X3 | forum.hr, "Bela u troje" — https://www.forum.hr/showthread.php?t=625064 | hr | Not fetched (403). Known only from a search summary: dispute over discarding a trump |
| X4 | mnovine.hr, article on the Bela Blok app — https://www.mnovine.hr/opcenito/emanuel-hodic-iz-vratisinca-napravio-aplikaciju-za-belu-posebno-je-rijesio-problem-igre-u-troje/ | hr | Not fetched (403). Only the title and search snippet were seen |
