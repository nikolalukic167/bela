import { useI18n } from '../../../i18n/i18n';

const Points = ({ trump }: { trump: boolean }) => (
  <table className="rules-table">
    <tbody>
      {(trump
        ? [['J', 20], ['9', 14], ['A', 11], ['10', 10], ['K', 4], ['Q', 3], ['8', 0], ['7', 0]]
        : [['A', 11], ['10', 10], ['K', 4], ['Q', 3], ['J', 2], ['9', 0], ['8', 0], ['7', 0]]
      ).map(([r, p]) => (
        <tr key={r}>
          <th scope="row">{r}</th>
          <td>{p}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

export function BelaRules() {
  const { lang } = useI18n();
  return lang === 'hr' ? <Hr /> : <En />;
}

function Hr() {
  return (
    <article className="rules">
      <h1>Pravila – Bela</h1>
      <p>
        Bela (belot) igra se s 32 karte (7, 8, 9, 10, dečko, dama, kralj, as u četiri boje). Igraju četiri igrača u dva para;
        partneri sjede jedan nasuprot drugome. Igra se suprotno od smjera kazaljke na satu.
      </p>
      <h2>Dijeljenje i zvanje aduta</h2>
      <p>
        Svaki igrač dobije 6 karata, a 2 karte (talon) ostaju skrivene. Počevši od igrača do djelitelja, svatko može zvati adut
        ili reći „dalje”. Ako svi kažu dalje, djelitelj <em>mora</em> zvati (mus). Nakon zvanja svatko uzima svoje 2 karte iz
        talona.
      </p>
      <h2>Snaga i vrijednost karata</h2>
      <div className="rules-cols">
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
        <li>Ako su bodovi točno jednaki, bodovi zvača <strong>vise</strong> i dobiva ih pobjednik iduće partije.</li>
        <li>Tko uzme sve štihove (štiglja) dobiva još 90 bodova.</li>
        <li>Pobjeđuje par koji prvi dođe do 1001 boda (može se igrati i do 501 ili 701).</li>
      </ul>
    </article>
  );
}

function En() {
  return (
    <article className="rules">
      <h1>Rules – Bela</h1>
      <p>
        Bela (Croatian Belot) uses 32 cards (7, 8, 9, 10, J, Q, K, A in four suits). Four players form two partnerships; partners
        sit opposite. Play goes counter-clockwise.
      </p>
      <h2>Deal and calling trump</h2>
      <p>
        Each player receives 6 cards, plus 2 face-down talon cards. Starting with the player after the dealer, each may call a
        trump suit or pass. If everyone passes, the dealer <em>must</em> call. After the call everyone picks up their 2 talon
        cards.
      </p>
      <h2>Card ranks and points</h2>
      <div className="rules-cols">
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
      </ul>
    </article>
  );
}
