import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, shareReplay, switchMap, tap } from 'rxjs';

export interface ChampionData {
  id: string; // "Aatrox"
  key: string; // "266" (numeric string)
  name: string;
  title: string;
  image: {
    full: string; // "Aatrox.png"
    sprite: string;
    group: string;
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

export interface ItemData {
  name: string;
  description: string;
  image: {
    full: string; // "1001.png"
    sprite: string;
    group: string;
    x: number;
    y: number;
    w: number;
    h: number;
  };
  // item.json e un map cu chei "1001", deci id-ul îl ținem separat când mapăm
  id?: string;
}

export interface SummonerSpellData {
  id: string; // "SummonerFlash"
  key: string; // "4" (numeric string)  <-- important pt lookup din match
  name: string;
  description: string;
  image: {
    full: string; // "SummonerFlash.png"
    sprite: string;
    group: string;
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

// --- DataDragon response shapes ---
type DDragonChampionsResponse = {
  data: Record<string, ChampionData>;
  version?: string;
};

type DDragonItemsResponse = {
  data: Record<string, ItemData>;
  version?: string;
};

type DDragonSummonerSpellsResponse = {
  data: Record<string, SummonerSpellData>;
  version?: string;
};

@Injectable({ providedIn: 'root' })
export class ChampionService {
  private http = inject(HttpClient);

  /**
   * IMPORTANT:
   * - Dacă ai proxy către https://ddragon.leagueoflegends.com, atunci BASE rămâne "/champion-data"
   * - BASE trebuie să fie "ddragon root"
   *
   * Exemple endpoint-uri prin BASE:
   *   /champion-data/api/versions.json
   *   /champion-data/cdn/<ver>/data/en_US/champion.json
   *   /champion-data/cdn/<ver>/img/champion/Aatrox.png
   */
  private readonly BASE = '/champion-data';

  // fallback dacă versions.json e blocat/offline
  private readonly FALLBACK_VERSION = '14.1.1';

  private versionValue: string = this.FALLBACK_VERSION;

  private version$?: Observable<string>;
  private championsResp$?: Observable<DDragonChampionsResponse>;
  private itemsResp$?: Observable<DDragonItemsResponse>;
  private spellsResp$?: Observable<DDragonSummonerSpellsResponse>;

  // --- VERSION ---
  getVersion(): Observable<string> {
    if (!this.version$) {
      this.version$ = this.http.get<string[]>(`${this.BASE}/api/versions.json`).pipe(
        map((versions) => versions?.[0] ?? this.FALLBACK_VERSION),
        tap((v) => (this.versionValue = v)),
        catchError(() => {
          this.versionValue = this.FALLBACK_VERSION;
          return of(this.FALLBACK_VERSION);
        }),
        shareReplay(1)
      );
    }
    return this.version$;
  }

  /** dacă vrei sync (pt helpers) */
  getVersionSync(): string {
    return this.versionValue;
  }

  // --- CHAMPIONS ---
  private getChampionsResp(): Observable<DDragonChampionsResponse> {
    if (!this.championsResp$) {
      this.championsResp$ = this.getVersion().pipe(
        switchMap((ver) =>
          this.http.get<DDragonChampionsResponse>(
            `${this.BASE}/cdn/${ver}/data/en_US/champion.json`
          )
        ),
        tap((resp) => {
          if (resp?.version) this.versionValue = resp.version;
        }),
        catchError(() => of({ data: {} })),
        shareReplay(1)
      );
    }
    return this.championsResp$;
  }

  /** array de championi */
  getChampions(): Observable<ChampionData[]> {
    return this.getChampionsResp().pipe(map((resp) => Object.values(resp.data ?? {})));
  }

  /** map: numeric key ("84") -> ChampionData (pentru match participant.championId) */
  getChampionsByKey(): Observable<Record<string, ChampionData>> {
    return this.getChampionsResp().pipe(
      map((resp) => {
        const out: Record<string, ChampionData> = {};
        for (const c of Object.values(resp.data ?? {})) out[c.key] = c;
        return out;
      }),
      shareReplay(1)
    );
  }

  /** map: id ("Aatrox") -> ChampionData */
  getChampionsById(): Observable<Record<string, ChampionData>> {
    return this.getChampionsResp().pipe(
      map((resp) => resp.data ?? {}),
      shareReplay(1)
    );
  }

  /** champion după numeric key ("84") */
  getChampionByKey(key: string): Observable<ChampionData | undefined> {
    return this.getChampionsByKey().pipe(map((m) => m[key]));
  }

  // --- ITEMS ---
  private getItemsResp(): Observable<DDragonItemsResponse> {
    if (!this.itemsResp$) {
      this.itemsResp$ = this.getVersion().pipe(
        switchMap((ver) =>
          this.http.get<DDragonItemsResponse>(`${this.BASE}/cdn/${ver}/data/en_US/item.json`)
        ),
        tap((resp) => {
          if (resp?.version) this.versionValue = resp.version;
        }),
        catchError(() => of({ data: {} })),
        shareReplay(1)
      );
    }
    return this.itemsResp$;
  }

  /** items ca array (cu id setat) */
  getItems(): Observable<ItemData[]> {
    return this.getItemsResp().pipe(
      map((resp) => Object.entries(resp.data ?? {}).map(([id, it]) => ({ ...it, id })))
    );
  }

  /** map: itemId ("1001") -> ItemData (cu id inclus) */
  getItemsById(): Observable<Record<string, ItemData>> {
    return this.getItemsResp().pipe(
      map((resp) => {
        const out: Record<string, ItemData> = {};
        for (const [id, it] of Object.entries(resp.data ?? {})) out[id] = { ...it, id };
        return out;
      }),
      shareReplay(1)
    );
  }

  // --- SUMMONER SPELLS ---
  private getSummonerSpellsResp(): Observable<DDragonSummonerSpellsResponse> {
    if (!this.spellsResp$) {
      this.spellsResp$ = this.getVersion().pipe(
        switchMap((ver) =>
          this.http.get<DDragonSummonerSpellsResponse>(
            `${this.BASE}/cdn/${ver}/data/en_US/summoner.json`
          )
        ),
        tap((resp) => {
          if (resp?.version) this.versionValue = resp.version;
        }),
        catchError(() => of({ data: {} })),
        shareReplay(1)
      );
    }
    return this.spellsResp$;
  }

  /** spells ca array */
  getSummonerSpells(): Observable<SummonerSpellData[]> {
    return this.getSummonerSpellsResp().pipe(map((resp) => Object.values(resp.data ?? {})));
  }

  /** map: spell numeric key ("4") -> SummonerSpellData (pt match summoner1Id/summoner2Id) */
  getSummonerSpellsByKey(): Observable<Record<string, SummonerSpellData>> {
    return this.getSummonerSpellsResp().pipe(
      map((resp) => {
        const out: Record<string, SummonerSpellData> = {};
        for (const s of Object.values(resp.data ?? {})) out[s.key] = s;
        return out;
      }),
      shareReplay(1)
    );
  }

  // =========================
  // Image URL helpers (safe)
  // =========================

  /** Champion square icon (Aatrox.png). championId aici = string "Aatrox" */
  getChampionImageUrl(championId: string, version?: string): string {
    const v = version ?? this.versionValue;
    return `${this.BASE}/cdn/${v}/img/champion/${championId}.png`;
  }

  /** Item icon (1001.png). itemId aici = "1001" */
  getItemImageUrl(itemId: string | number, version?: string): string {
    const v = version ?? this.versionValue;
    const id = String(itemId);
    if (!id || id === '0') return '';
    return `${this.BASE}/cdn/${v}/img/item/${id}.png`;
  }

  /** Spell icon (SummonerFlash.png). spellId aici = "SummonerFlash" */
  getSummonerSpellImageUrl(spellId: string, version?: string): string {
    const v = version ?? this.versionValue;
    return `${this.BASE}/cdn/${v}/img/spell/${spellId}.png`;
  }

  /**
   * (Pentru match) championKey numeric (ex: 84) -> url icon
   * Ai nevoie de champion map (byKey) ca să transformi numeric -> "Akali.png"
   */
  championSquareUrlByNumericKeySync(
    championKey: number | string,
    championsByKey: Record<string, ChampionData>,
    version?: string
  ): string {
    const v = version ?? this.versionValue;
    const champ = championsByKey[String(championKey)];
    if (!champ) return '';
    return `${this.BASE}/cdn/${v}/img/champion/${champ.image.full}`;
  }

  /** (Pentru match) spellKey numeric (ex: 4) -> url icon */
  spellIconUrlByNumericKeySync(
    spellKey: number | string,
    spellsByKey: Record<string, SummonerSpellData>,
    version?: string
  ): string {
    const v = version ?? this.versionValue;
    const sp = spellsByKey[String(spellKey)];
    if (!sp) return '';
    return `${this.BASE}/cdn/${v}/img/spell/${sp.image.full}`;
  }

  /** spell name by numeric key */
  spellNameByNumericKeySync(
    spellKey: number | string,
    spellsByKey: Record<string, SummonerSpellData>
  ): string {
    return spellsByKey[String(spellKey)]?.name ?? '';
  }

  /** champion name by numeric key */
  championNameByNumericKeySync(
    championKey: number | string,
    championsByKey: Record<string, ChampionData>
  ): string {
    return championsByKey[String(championKey)]?.name ?? '';
  }

  /** păstrăm și astea (dar corecte) */
  getChampionSquareImageUrl(championId: string, version?: string): string {
    // în DataDragon, square e tot champion/<Aatrox>.png
    return this.getChampionImageUrl(championId, version);
  }

  getPassiveImageUrl(passiveFilename: string, version?: string): string {
    const v = version ?? this.versionValue;
    return `${this.BASE}/cdn/${v}/img/passive/${passiveFilename}`;
  }
}
