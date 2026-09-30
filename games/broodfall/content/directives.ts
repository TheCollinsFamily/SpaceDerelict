/**
 * EMPIRE DIRECTIVES — Command's STANDING ORDERS to the technician (DESIGN.md "Two mission tracks":
 * "Command directives pay STANDING … phrased in sterile procurement language; push the player
 * off comfort builds like Balatro boss blinds (capture royals alive, field-test an unstable organ
 * lineage, clear under time)"). The screen is src/ui/directives.ts; the rules src/meta/directives.ts.
 *
 * A deployment's own directive (hold N waves / destroy the royal / bank science) is the landing
 * site's (content/campaign.ts TERRITORIES) and wins the run. A STANDING ORDER runs across
 * deployments: three are open at once, issued in this list's order as the ones before are
 * fulfilled, from the day Command clears the Directive Desk. Progress is what each deployment
 * adds; the order pays standing when it is full, and some issue something with it (equipment for
 * every deployment while the order is open; a lineage kept for good when it is fulfilled).
 *
 * Voice: the Xenofauna Clearance Office (content/lore/empire.md sections 2-3 and 12): the Index's
 * forms, short because busywork is a sin, cheerful because gloom is one, every one with its line
 * for "expected contribution" that nobody knows who reads.
 */
import type { OrganId, SimConfig } from '../src/sim/types';

export interface OrderDef {
  id: string;
  /** The form's number, e.g. "SO 2-K". */
  form: string;
  title: string;
  /** The order, with {n} for its target. */
  text: string;
  /**
   * What a deployment adds to it:
   *   a run measure (src/meta/goals.ts: 'kills:any', 'stat:earlyCalls' …), summed; or
   *   'camp:captured' | 'camp:repelled' | 'camp:won' | 'camp:hard' (a territory of tier 3+ taken).
   */
  measure: string;
  target: number;
  /** Count deployments instead: each one where `measure` reached `min` adds 1. */
  each?: { min: number; needsWin?: boolean };
  /** Standing paid on fulfilment. */
  pays: number;
  /** Issued with the order and carried by every deployment while it is open (Command's equipment). */
  equip?: Partial<SimConfig>;
  /** A sanctioned lineage put on trial: in the deployments' organ pool while open, the technician's for good when fulfilled. */
  trial?: OrganId[];
  /** The Office's line for expected contribution. */
  contribution: string;
  /** The acknowledgement filed when it is fulfilled. */
  ack: string;
}

export const ORDERS: OrderDef[] = [
  {
    id: 'acquisition', form: 'SO 2-K', title: 'Territorial Acquisition',
    text: 'Bring {n} landing sites under asset control.', measure: 'camp:captured', target: 3, pays: 4,
    contribution: 'Living room for approximately 2,400 Houses.',
    ack: 'The Office acknowledges three sites. Surveyors have been scheduled. You will not meet them.',
  },
  {
    id: 'aggregate', form: 'SO 7-Q', title: 'Aggregate Clearance, Serial',
    text: 'Neutralize {n} specimens of any rank, across deployments.', measure: 'kills:any', target: 600, pays: 3,
    contribution: 'One fewer generation of specimens to neutralize later.',
    ack: 'Quota met. The count has been rounded to the nearest specimen.',
  },
  {
    id: 'tithe', form: 'SO 4-S', title: 'Sample Tithe',
    text: 'Bank {n} science across deployments.', measure: 'stat:scienceBanked', target: 250, pays: 3,
    contribution: 'Samples for the Index\'s xenofauna record. The record is very long.',
    ack: 'Samples received and catalogued. Several were labelled in a cheerful hand. Please use the form labels.',
  },
  {
    id: 'live-royal', form: 'SO 22-R', title: 'Live Royal Retrieval',
    text: 'Capture {n} royal specimen alive. A trap cage is issued with every deployment until this order is filled.',
    measure: 'stat:royalsCaptured', target: 1, pays: 5, equip: { trapCage: true },
    contribution: 'A breeding royal for the Index\'s study of eusocial succession.',
    ack: 'Royal specimen logged as retrieved. The Office regrets it was then used as a weapon. The Office has no form for this and has filed it under "retrieved".',
  },
  {
    id: 'royal-removal', form: 'SO 5-R', title: 'Royal Removal',
    text: 'Destroy {n} royals.', measure: 'kills:royal', target: 3, pays: 4,
    contribution: 'Each royal removed is a colony that does not bud.',
    ack: 'Three royals removed. The succession of this planet is now a matter for the planet.',
  },
  {
    id: 'field-trial', form: 'SO 31-F', title: 'Lineage Field Trial',
    text: 'Field-test the issued lineage: win {n} deployments with it in the organism.', measure: 'camp:won', target: 2, pays: 3,
    trial: ['nerve', 'acid', 'mire', 'venom', 'womb', 'brain', 'lattice'],
    contribution: 'A lineage the Office may standardize, if it does not kill the technician.',
    ack: 'Trial complete. The lineage is entered in your genome permanently. The Office notes you survived it.',
  },
  {
    id: 'holding', form: 'SO 9-D', title: 'Holding Pattern',
    text: 'Repel {n} counter-attacks on held ground.', measure: 'camp:repelled', target: 2, pays: 4,
    contribution: 'Ground cleared once is ground not cleared twice.',
    ack: 'Two counter-attacks repelled. The locals have been noted as persistent. So has the technician.',
  },
  {
    id: 'aerial', form: 'SO 13-A', title: 'Aerial Denial',
    text: 'Down {n} fliers across deployments.', measure: 'kills:flier', target: 60, pays: 3,
    contribution: 'A clear sky for the surveyors, who will not come until it is clear.',
    ack: 'Airspace noted as cleared. It will be noted as uncleared again shortly. That is normal.',
  },
  {
    id: 'schedule', form: 'SO 8-T', title: 'Schedule Adherence',
    text: 'Clear under time: call {n} waves early, across deployments.', measure: 'stat:earlyCalls', target: 8, pays: 3,
    contribution: 'Deployments that end on time. The Office has never had one.',
    ack: 'Schedule adhered to. This is a first for Sector 9. There is no prize. Please continue.',
  },
  {
    id: 'preservation', form: 'SO 11-P', title: 'Asset Preservation, Serial',
    text: 'Win {n} deployments with the core above 60% at the end.', measure: 'coreEnd', target: 3, each: { min: 60, needsWin: true }, pays: 4,
    contribution: 'Navy property returned in the condition it was issued.',
    ack: 'Three clean returns. Asset BF-7 is described in the ledger as "serviceable". It is the ledger\'s highest word.',
  },
  {
    id: 'hard-posting', form: 'SO 6-H', title: 'Hard Posting',
    text: 'Take {n} landing site of threat tier 3 or higher.', measure: 'camp:hard', target: 1, pays: 5,
    contribution: 'Proof, for the Board, that the technician can be sent anywhere.',
    ack: 'Hard posting completed. The Board has been told. The Board has said "noted".',
  },
  {
    id: 'tissue', form: 'SO 12-A', title: 'Tissue Maintenance, Serial',
    text: 'Restore {n} hp of limb tissue across deployments.', measure: 'stat:healed', target: 3000, pays: 3,
    contribution: 'Fewer requisitions for replacement tissue. The warehouse thanks you. The warehouse is an algorithm.',
    ack: 'Tissue maintained. The asset has been described as "well kept" by a surveyor who has not seen it.',
  },
  {
    id: 'density', form: 'SO 3-F', title: 'Deployment Density, Serial',
    text: 'Grow {n} limbs across deployments.', measure: 'stat:limbsGrown', target: 60, pays: 3,
    contribution: 'A denser asset, and a proportionally denser report.',
    ack: 'Density achieved. The report was also dense. Thank you for keeping it short.',
  },
];

/** How many standing orders are open at once. */
export const ORDERS_OPEN = 3;

/** The screen's letterhead and small print, in the Office's voice. */
export const ORDERS_HEAD = 'XENOFAUNA CLEARANCE OFFICE · SECTOR 9 · STANDING ORDERS FOR THE TECHNICIAN (UNLICENSED), TENDER "MERCIFUL YOKE"';
export const ORDERS_FOOT = [
  'Standing orders run across deployments. They are fulfilled by the asset\'s ordinary conduct and require no application.',
  'Every order carries a line for expected contribution. It is read.',
  'This page has been kept short. Busywork is ranked below indulgence (Office style guide, after TP 35.0.3).',
];
