import type { Card as CardT, Rank } from '../../../core/cards';
import { useI18n } from '../../../i18n/i18n';
import { Card } from '../../../ui/Card';
import { useCardNames } from '../../../ui/decks';

const TRUMP: [Rank, number][] = [['J', 20], ['9', 14], ['A', 11], ['10', 10], ['K', 4], ['Q', 3], ['8', 0], ['7', 0]];
const PLAIN: [Rank, number][] = [['A', 11], ['10', 10], ['K', 4], ['Q', 3], ['J', 2], ['9', 0], ['8', 0], ['7', 0]];

/** Card values, with rank letters from the viewer's deck (U/O on Hungarian cards, J/Q on French). */
function Points({ trump }: { trump: boolean }) {
  const { rank } = useCardNames();
  return (
    <table className="table table-sm w-auto">
      <tbody>
        {(trump ? TRUMP : PLAIN).map(([r, p]) => (
          <tr key={r}>
            <th scope="row">{rank(r)}</th>
            <td>{p}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const SHOWCASE: CardT[] = (['A', 'K', 'Q', 'J'] as Rank[]).map((rank) => ({ suit: 'hearts', rank }));

/** The four highest hearts in the viewer's deck, so the names below match what they see at the table. */
function Showcase() {
  const { card } = useCardNames();
  return (
    <div className="not-prose flex gap-2" style={{ '--cw': '64px' } as React.CSSProperties}>
      {SHOWCASE.map((c) => (
        <Card key={c.rank} card={c} label={card(c)} />
      ))}
    </div>
  );
}

export function BelaRules() {
  const { lang } = useI18n();
  return lang === 'hr' ? <Hr /> : <En />;
}

function Hr() {
  return (
    <article className="prose max-w-none">
      <h1>Pravila – Bela</h1>
      <p>
        Bela (belot) igra se s 32 karte (7, 8, 9, 10, dečko, dama, kralj, as u četiri boje). Igraju četiri igrača u dva para;
        partneri sjede jedan nasuprot drugome. Igra se suprotno od smjera kazaljke na satu.
      </p>
      <h2>Karte</h2>
      <p>
        Igra se s mađaricama ili s francuskim kartama, kako ti je draže (Izbornik → Postavke → Špil karata). Na mađaricama su
        boje <strong>srce</strong>, <strong>bundeva</strong>, <strong>žir</strong> i <strong>zelje</strong> (kao herc, karo,
        tref i pik), a umjesto dečka i dame su <strong>unter</strong> (U) i <strong>ober</strong> (O). Asovi prikazuju četiri
        godišnja doba.
      </p>
      <Showcase />
      <h2>Dijeljenje i zvanje aduta</h2>
      <p>
        Svaki igrač dobije 6 karata, a 2 karte (talon) ostaju skrivene do zvanja aduta. Počevši od igrača do djelitelja, svatko može zvati adut
        ili reći „dalje”. Ako svi kažu dalje, djelitelj <em>mora</em> zvati (mus). Nakon zvanja svatko uzima svoje 2 karte iz
        talona.
      </p>
      <h2>Snaga i vrijednost karata</h2>
      <div className="flex flex-wrap gap-8">
        <div>
          <h3>Adut</h3>
          <Points trump />
        </div>
        <div>
          <h3>Ostale boje</h3>
          <Points trump={false} />
        </div>
      </div>
      <p>Zadnji štih nosi još 10 bodova, pa je u igri ukupno 162 boda.</p>
      <h2>Igranje</h2>
      <ul>
        <li>Mora se odgovoriti na boju i, ako je moguće, igrati jaču kartu od one koja trenutno nosi štih.</li>
        <li>Tko nema boju mora sjeći adutom, i to jačim adutom ako je štih već presječen.</li>
        <li>Tko nema ni boju ni adut baca bilo koju kartu.</li>
      </ul>
      <h2>Zvanja</h2>
      <ul>
        <li>Tri karte u nizu iste boje: 20 · četiri: 50 · pet ili više: 100</li>
        <li>Četiri dečka: 200 · četiri devetke: 150 · četiri asa, desetke, kralja ili dame: 100</li>
        <li>Svih osam karata iste boje (belot) – odmah pobjeđuje cijelu igru.</li>
        <li>
          Boduje samo par s najjačim zvanjem (vrijednost, pa duljina, pa jača karta, pa adutska boja, pa redoslijed igranja), ali
          zato boduje sva svoja zvanja. Zvanja se pokazuju nakon prvog štiha.
        </li>
        <li>Bela: kralj i dama u adutu kod istog igrača – 20 bodova, javlja se kad se odigra druga od te dvije karte.</li>
      </ul>
      <h2>Bodovanje</h2>
      <ul>
        <li>Par koji je zvao mora imati više od polovice ukupnih bodova (karte + zvanja + bela). Inače je <strong>pad</strong> i protivnici dobivaju sve.</li>
        <li>Ako su bodovi točno jednaki, bodovi zvača <strong>vise</strong> i dobiva ih pobjednik iduće ruke.</li>
        <li>Tko uzme sve štihove (štiglja) dobiva još 90 bodova.</li>
        <li>Pobjeđuje par koji prvi dođe do 1001 boda (može se igrati i do 501 ili 701).</li>
        <li>
          Kućna pravila pri novoj igri: <em>bela se uvijek piše</em> (par koji je zvao belu zadržava 20 i kad padne) i
          <em> kad je jednako</em> – bodovi vise ili zvač pada.
        </li>
      </ul>
    </article>
  );
}

function En() {
  return (
    <article className="prose max-w-none">
      <h1>Rules – Bela</h1>
      <p>
        Bela (Croatian Belot) uses 32 cards (7, 8, 9, 10, J, Q, K, A in four suits). Four players form two partnerships; partners
        sit opposite. Play goes counter-clockwise.
      </p>
      <h2>The cards</h2>
      <p>
        Play with Hungarian-pattern cards (<em>mađarice</em>) or French cards, whichever you prefer (Menu → Settings → Card
        deck). The Hungarian suits are <strong>hearts</strong>, <strong>bells</strong>, <strong>acorns</strong> and{' '}
        <strong>leaves</strong> (for hearts, diamonds, clubs and spades), and the <strong>Unter</strong> (U) and{' '}
        <strong>Ober</strong> (O) take the place of the Jack and Queen. The aces show the four seasons.
      </p>
      <Showcase />
      <h2>Deal and calling trump</h2>
      <p>
        Each player receives 6 cards, plus 2 face-down talon cards. Starting with the player after the dealer, each may call a
        trump suit or pass. If everyone passes, the dealer <em>must</em> call. After the call everyone picks up their 2 talon
        cards.
      </p>
      <h2>Card ranks and points</h2>
      <div className="flex flex-wrap gap-8">
        <div>
          <h3>Trump</h3>
          <Points trump />
        </div>
        <div>
          <h3>Other suits</h3>
          <Points trump={false} />
        </div>
      </div>
      <p>The last trick is worth 10 more, for 162 points per hand.</p>
      <h2>Play</h2>
      <ul>
        <li>You must follow suit and, if you can, play a card that beats the one currently winning the trick.</li>
        <li>If void in the led suit you must trump, overtrumping if the trick is already trumped and you can.</li>
        <li>With neither the led suit nor trumps, play anything.</li>
      </ul>
      <h2>Declarations (zvanja)</h2>
      <ul>
        <li>Sequence of 3 in a suit: 20 · 4: 50 · 5 or more: 100</li>
        <li>Four Jacks: 200 · four Nines: 150 · four Aces, Tens, Kings or Queens: 100</li>
        <li>All eight cards of one suit (belot) wins the whole match.</li>
        <li>
          Only the team with the best single declaration scores (value, then length, then top card, then trump suit, then play
          order) – but it scores all of its declarations. They are shown after the first trick.
        </li>
        <li>Bela: King and Queen of trump in one hand – 20 points, announced when the second one is played.</li>
      </ul>
      <h2>Scoring</h2>
      <ul>
        <li>The calling team must take more than half of all points (cards + declarations + bela). Otherwise they <strong>fail</strong> and the opponents score everything.</li>
        <li>On an exact tie the callers’ points <strong>hang</strong> and go to the winner of the next hand.</li>
        <li>Taking every trick (štiglja) adds 90 points.</li>
        <li>First team to 1001 wins (501 or 701 also available).</li>
        <li>
          House rules when starting a game: <em>bela always counts</em> (a team that announced bela keeps its 20 even
          when its contract fails) and <em>on an exact tie</em> – points hang, or the callers fail.
        </li>
      </ul>
    </article>
  );
}
