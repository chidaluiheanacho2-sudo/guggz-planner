"use strict";
/* Guggz's Planner — offline training app. All data stays on this device (localStorage + IndexedDB for photos). */
const VERSION = "4.4.0";

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = n => { n = +n; return Number.isFinite(n) ? (Math.round(n * 100) / 100).toString() : "–"; };
const clone = o => JSON.parse(JSON.stringify(o));
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const pad = n => String(n).padStart(2, "0");
const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => isoOf(new Date());
const parseISO = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return isoOf(d); };
const weekStart = s => { const d = parseISO(s); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return isoOf(d); };
const dow = s => (parseISO(s).getDay() + 6) % 7;
const toMin = t => { const [h, m] = String(t || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const toHM = m => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
const niceDate = s => parseISO(s).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
const shortDate = s => parseISO(s).toLocaleDateString(undefined, { day: "numeric", month: "short" });
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const roundTo = (x, s = 1.25) => Math.round(x / s) * s;
const restSecs = r => { const m = String(r || "").match(/(\d+(?:\.\d+)?)\s*(?:[–-]\s*\d+(?:\.\d+)?)?\s*(min|s)/i); if (!m) return 90; return Math.round(+m[1] * (m[2].toLowerCase() === "min" ? 60 : 1)); };

/* ---------- default program ---------- */
const DEFAULT_WARMUP = [
  { id: "hfs", name: "Half-kneeling hip flexor stretch", dose: "2 × 30 s per side", cue: "Tuck your tailbone under and squeeze the back glute before leaning forward. If you feel it in your lower back, tuck more." },
  { id: "couch", name: "Couch stretch", dose: "2 × 30 s per side", cue: "Back knee against a wall or bench, shin up the wall. Keep your ribs down so it stays a quad and hip-flexor stretch." },
  { id: "bridge", name: "Glute bridge with posterior tilt", dose: "2 × 12, 2 s squeeze", cue: "Flatten your lower back into the floor first, then lift. Stop before your back arches." },
  { id: "deadbug", name: "Dead bug", dose: "2 × 8 per side", cue: "Lower back pressed down the whole time. Slow, and breathe out as the leg extends." },
  { id: "birddog", name: "Bird dog", dose: "1 × 8 per side", cue: "Hips level, reach long rather than high." },
  { id: "dyn", name: "Sprint drills: leg swings, A-skips, B-skips, 3 build-up runs", dose: "≈6 min", cue: "Leg swings 10 each way, A-skips and B-skips 2 × 15 m, then three runs over 30 m building to about 90% speed." }
];
const DEFAULT_UPPER_WARM = [
  { id: "uw-wrist", name: "Wrist circles and rocks", dose: "1 min", cue: "Circle your wrists both ways, then on all fours rock gently forward and back over your hands: palms down, then fingers pointing back toward your knees. Handstands and planche put a lot of load through your wrists." },
  { id: "uw-arm", name: "Arm circles and band pull-aparts", dose: "2 × 15", cue: "Big arm circles both ways, then pull a light band apart at chest height, squeezing your shoulder blades." },
  { id: "uw-scap", name: "Scap push-ups and scap pulls", dose: "1 × 10 each", cue: "Push-up position with straight arms: let your chest sink between your shoulders, then push the floor away. Then hang from the bar and pull your shoulders down without bending your arms." },
  { id: "uw-ramp", name: "Easy skill practice", dose: "2 × 10 s", cue: "Two easy holds of your first skill (wall handstand or planche lean) before your working sets." }
];
const DEFAULT_DAYS = [
  { id: "UA", name: "Upper A", focus: "Strength + skills", kind: "upper", prep: false, note: "Skills first while you're fresh, then heavy belt work and the gym lifts. Rest 2–3 min on big lifts and stop 1–2 reps short of failure; take isolation lifts (laterals, curls, abs) to 0–1 reps left. The incline walk at the end is optional.", ex: [
    { id: "hs", name: "Handstand", skill: ["Chest-to-wall hold", "Wall hold with shoulder taps", "Freestanding kick-up holds", "Freestanding hold"], sets: 4, lo: 15, hi: 30, unit: "skill", rest: "90 s", cue: "Push the floor away, ribs tucked, glutes squeezed. Stop when your line breaks rather than when you collapse." },
    { id: "lsit", name: "L-sit on parallettes", skill: ["Tuck L-sit", "One-leg L-sit", "Full L-sit", "Straddle L-sit to V-sit"], sets: 3, lo: 10, hi: 20, unit: "skill", rest: "90 s", cue: "Shoulders pushed down away from your ears, arms locked. Builds the core strength you need for harder skills." },
    { id: "wpu", iso: "Final rep: hold your chin over the bar for 5 s.", name: "Weighted pull-up", sets: 4, lo: 6, hi: 8, inc: 2.5, unit: "kg", rest: "3 min", cue: "Dip belt. Dead hang, pull until your chin clears the bar." },
    { id: "wdip", iso: "Final rep: 3 s pause at the bottom, shoulders just below elbows.", name: "Weighted dip", sets: 4, lo: 6, hi: 8, inc: 2.5, unit: "kg", rest: "3 min", cue: "Dip belt on parallel bars. Shoulders just below elbows, slight forward lean." },
    { id: "incdb", iso: "Final rep: 2 s pause at the bottom with the dumbbells level with your chest.", name: "Incline dumbbell press (30°)", sets: 3, lo: 6, hi: 10, inc: 2, unit: "load", rest: "2–3 min", cue: "Bench at about 30°. Pin your shoulder blades back and down, feet planted. Lower for 2–3 s into a deep chest stretch, then press up and slightly in. Hits the upper chest that dips and push-ups under-train. Log one dumbbell." },
    { id: "csrow", iso: "Final rep: hold the top 2 s with your shoulder blades squeezed.", name: "Chest-supported row (machine, T-bar or dumbbells)", sets: 3, lo: 6, hi: 10, inc: 2.5, unit: "load", rest: "2 min", cue: "Chest stays on the pad so your lower back can't cheat, which lets you go heavy and close to failure. Let your shoulder blades stretch forward at the bottom, then drive your elbows back toward your hips for lats, or out at 45° for upper back. Log kg per side or per dumbbell, the same way every time." },
    { id: "clat", iso: "Last set: when full reps stop, keep going with half reps in the bottom stretch until you can't move it.", name: "Cable lateral raise", sets: 3, lo: 10, hi: 15, inc: 1.25, unit: "load", rest: "60–90 s", cue: "One arm at a time, cable at hand height or lower and running behind your body. Lead with the elbow up to shoulder height, lower for 2 s. Side delts are what make shoulders look wide. No cable? A dumbbell works just as well; lean away from a post. Log the stack weight." },
    { id: "ccchin", iso: "Final rep: hold at 90° elbow bend for 5 s.", name: "Close-grip chin-up (bodyweight or belt)", bwStart: true, sets: 3, lo: 6, hi: 10, inc: 2.5, unit: "kg", rest: "2 min", cue: "Hands shoulder-width or closer, palms facing you. 3 s lowering. Keep your elbows in front to work the biceps." },
    { id: "hammer", iso: "Final rep: hold with elbows at 90° for 10 s.", name: "Dumbbell hammer curl", sets: 3, lo: 10, hi: 12, inc: 1, unit: "load", rest: "90 s", cue: "Log the weight of one dumbbell. Elbows stay pinned to your sides." },
    { id: "hlr", iso: "Every rep: 2 s hold at the top with your pelvis curled up.", name: "Weighted hanging leg raise", bwStart: true, sets: 3, lo: 8, hi: 12, inc: 1, unit: "kg", rest: "90 s", cue: "Ab exercise 1. Start at bodyweight with bent knees. Once every set hits 12 clean reps, squeeze a light dumbbell between your feet (log it as added kg) and keep adding 1 kg. Curl your pelvis toward your ribs at the top, no swinging." }] },
  { id: "LA", name: "Lower A", focus: "Acceleration power", kind: "lower", prep: true, note: "Heavy, sprint-specific strength paired with jumps. Do each contrast pair as: strength set, rest 1–2 min, jump set, then rest 3–4 min before the next pair. Full effort on every jump; stop a set if they get slower or lower.", ex: [
    { id: "sled", name: "Heavy sled push or drag (20 m)", unit: "sled", sets: 6, maxSets: 8, lo: 1, hi: 1, inc: 5, rest: "2–3 min", cue: "Gym sled or prowler, or clip a sled harness to your dip belt. Load it so you move at roughly half your normal sprint speed. Lean forward and drive like the first steps of a sprint. No sled? Skip this; the hill sprints on your park day do a similar job." },
    { id: "wbss", iso: "Final rep: hold the bottom, back knee just off the floor, for 10 s.", name: "Weighted Bulgarian split squat", sets: 4, lo: 6, hi: 8, inc: 2.5, unit: "kg", rest: "1–2 min", cue: "Contrast pair A, part 1. Per leg, dumbbells or dip belt. Back knee to the floor, drive up hard. Then go straight into broad jumps." },
    { id: "broad", iso: "Every jump: freeze the landing for 2 s before you measure.", name: "Standing broad jump", sets: 4, lo: 3, hi: 3, unit: "best", contacts: 3, rest: "3–4 min", cue: "Contrast pair A, part 2. Big arm swing, jump out, stick the landing. Horizontal jumps carry over best to sprinting. Log your best distance each set." },
    { id: "beltsq", iso: "Final rep: 3 s pause at the bottom.", name: "Dip-belt squat", sets: 4, lo: 6, hi: 8, inc: 5, unit: "kg", rest: "1–2 min", cue: "Contrast pair B, part 1. Stand on two boxes or benches with a plate hanging from your dip belt, and squat to thighs parallel. Heavy leg work with no bar on your back. Then go into drop jumps." },
    { id: "drop", iso: "Last rep of each set: stick the landing in a half squat for 3 s.", name: "Drop jump", sets: 4, lo: 3, hi: 5, inc: 5, unit: "cm", start: 30, contacts: 1, rest: "3–4 min", cue: "Contrast pair B, part 2. Step off the box, land and leave the floor as fast as possible. Short contact matters more than height." },
    { id: "pogo", iso: "After the last contact: hold high on your toes for 10 s.", name: "Ankle hops (pogos)", sets: 3, lo: 15, hi: 20, unit: "bw", contacts: 1, next: "switch to single-leg pogos", rest: "90 s", cue: "Stiff ankles, bounce off the balls of your feet, minimal knee bend. Each contact is one rep." },
    { id: "nord", iso: "Every rep: 2 s hold at the point you start to lose control.", name: "Nordic hamstring curl", sets: 3, lo: 5, hi: 8, unit: "bw", next: "slow the lowering to 5 s, then hold a plate at your chest", rest: "2 min", cue: "Feet anchored, lower as slowly as you can and catch yourself. Strong evidence for cutting hamstring strains." }] },
  { id: "UB", name: "Upper B", focus: "Hypertrophy + skills", kind: "upper", prep: false, note: "Skills first while you're fresh, then moderate loads for 8–15 reps. Use full range and control the stretch on every rep, and take the last set of each isolation lift close to failure. The incline walk at the end is optional.", ex: [
    { id: "planche", name: "Planche on parallettes", skill: ["Planche lean", "Tuck planche", "Advanced tuck planche", "Straddle planche"], sets: 4, lo: 8, hi: 15, unit: "skill", rest: "2 min", cue: "On your parallettes. Arms locked, shoulders pushed forward and leaning past your hands. The handles let you grip neutrally, which spares your wrists and gives you a bit more room to tuck." },
    { id: "flever", name: "Front lever", skill: ["Scap pull hold", "Band-assisted tuck front lever", "Tuck front lever", "Advanced tuck front lever", "One-leg front lever", "Straddle front lever"], sets: 4, lo: 8, hi: 15, unit: "skill", rest: "2 min", cue: "On the pull-up bar with straight arms the whole time. Not strong enough for a tuck yet? Start with scap pull holds: hang, pull your shoulders down and back without bending your arms, and hold. Next, loop a thick resistance band over the bar and under your hips for the tuck; use a thinner band as you get stronger. Extra help: slow tuck negatives at the end of the set (from the top of a pull-up, lean back into a tuck and lower for 5 s). Squeeze the bar toward your hips and keep your lower back rounded, not arched." },
    { id: "wchin", iso: "Final rep: hold your chin over the bar for 5 s, then pause 3 s at 90° on the way down.", name: "Chin-up (bodyweight or belt)", bwStart: true, sets: 4, lo: 8, hi: 10, inc: 2.5, unit: "kg", rest: "2 min", cue: "Bodyweight until you own 10 reps, then belt. Palms facing you, full hang to chest toward the bar." },
    { id: "wpush", iso: "Final rep: hold 5 s with your chest just off the floor.", name: "Weighted push-up", sets: 4, lo: 8, hi: 12, inc: 2.5, unit: "kg", rest: "90 s", cue: "Plate on your upper back, or hands on parallettes for extra depth. Body in one line." },
    { id: "cfly", iso: "Final rep: hold the bottom stretch for 3 s.", name: "Cable fly or pec deck", sets: 3, lo: 10, hi: 15, inc: 2.5, unit: "load", rest: "90 s", cue: "Slight bend in the elbows, chest up. Open until you feel a big stretch across your chest, then hug your arms together. Machines keep tension on the chest in the stretch, where dumbbell flyes go easy. Log the stack kg on the same machine each time." },
    { id: "wngpu", iso: "Every rep: 1 s pause at the top.", name: "Weighted neutral-grip pull-up", sets: 3, lo: 10, hi: 12, inc: 1.25, unit: "kg", rest: "90 s", cue: "Dip belt on parallel handles. Controlled 2 s lowering." },
    { id: "clat", iso: "Last set: when full reps stop, keep going with half reps in the bottom stretch until you can't move it.", name: "Cable lateral raise", sets: 3, lo: 10, hi: 15, inc: 1.25, unit: "load", rest: "60–90 s", cue: "Second hit of the week for wider shoulders. Same set-up as Upper A, so your weights carry over." },
    { id: "cface", iso: "Every rep: 2 s hold at your forehead.", name: "Cable face pull", sets: 3, lo: 12, hi: 15, inc: 2.5, unit: "load", rest: "60 s", cue: "Rope at head height. Pull to your forehead with elbows high and rotate your hands back. Rear delts and upper back for posture. Log the stack kg." },
    { id: "incurl", iso: "Every rep: 1 s hold in the bottom stretch.", name: "Incline dumbbell curl", sets: 3, lo: 8, hi: 12, inc: 1, unit: "load", rest: "90 s", cue: "Bench at about 45°, arms hanging behind your body. Log one dumbbell." },
    { id: "ccrunch", iso: "Every rep: 1 s squeeze at the bottom.", name: "Kneeling cable crunch", sets: 3, lo: 10, hi: 15, inc: 2.5, unit: "load", rest: "60–90 s", cue: "Ab exercise 2, and the easiest abs to overload: just move the pin. Rope behind your head, kneel facing the stack. Hips stay still; curl your ribs down toward your pelvis and let the weight stretch your abs at the top. Log the stack kg." }] },
  { id: "LB", name: "Lower B", focus: "Reactive power", kind: "lower", prep: true, note: "Fast, springy contacts and single-leg power for top speed. Same contrast format: strength set, rest 1–2 min, jump set, then rest 3–4 min. Quit a set once quality drops.", ex: [
    { id: "hurdle", iso: "Last hurdle: stick the landing for 2 s.", name: "Hurdle hops (5 hurdles)", sets: 3, lo: 2, hi: 3, inc: 5, unit: "cm", start: 30, contacts: 5, rest: "2 min", cue: "Each rep is one run over 5 mini hurdles or cones. Quick off the ground, knees up. Hurdle height goes in the first column." },
    { id: "sldrop", iso: "Every rep: hold the landing on one leg for 2 s before the next.", name: "Single-leg drop jump", sets: 3, lo: 4, hi: 5, inc: 5, unit: "cm", start: 20, contacts: 2, rest: "2–3 min", cue: "Per leg, alternating. From a low box, land on one leg and bounce straight up as fast as you can. Raise the box only when contacts stay quick." },
    { id: "wstep", iso: "Final rep: hold the top on one leg for 3 s.", name: "Weighted step-up", sets: 3, lo: 6, hi: 8, inc: 2.5, unit: "load", rest: "1–2 min", cue: "Contrast pair, part 1. Per leg, knee-height box, one dumbbell in each hand (log one). Drive through the front foot only. Then go into bounds." },
    { id: "bound", iso: "Final bound of each rep: stick the landing on one leg for 2 s.", name: "Alternating bounds (5 contacts)", sets: 4, lo: 1, hi: 1, unit: "best", contacts: 5, rest: "3–4 min", cue: "Contrast pair, part 2. Each rep is 5 bounds from a standing start. Drive the knee up, push off the ground behind you. Log total distance." },
    { id: "wsrdl", iso: "Every rep: 2 s hold in the bottom stretch.", name: "Weighted single-leg RDL", sets: 3, lo: 6, hi: 8, inc: 2.5, unit: "load", rest: "2 min", cue: "Per leg, log one dumbbell. Hips square and feel the hamstring stretch." },
    { id: "wslht", iso: "Final rep: hold the top for 10 s with your pelvis tucked.", name: "Weighted single-leg hip thrust", sets: 3, lo: 8, hi: 12, inc: 2.5, unit: "kg", rest: "90 s", cue: "Per leg, plate on your hip. Tuck your pelvis at the top. Trains the glutes your pelvic tilt needs." },
    { id: "slcalf", iso: "Every rep: 2 s hold at the top.", name: "Weighted single-leg calf raise", sets: 3, lo: 8, hi: 12, inc: 2.5, unit: "load", rest: "60 s", cue: "Per leg on a step, dumbbell in one hand. 1 s pause at the bottom." }] },
  { id: "SP", name: "Park sprints", focus: "Speed", kind: "sprint", prep: true, note: "Once a week in the park, on grass or a path. Quality over quantity: walk back slowly and take the full rest. End the session if a rep is clearly slower than your best for the day.", ex: [
    { id: "accel", name: "Acceleration sprint 20 m", unit: "time", speed: "20m", sets: 4, maxSets: 6, lo: 1, hi: 1, rest: "2 min", cue: "Crouch or 3-point start. Push the ground back hard for the first 6–8 steps and rise gradually. Best timing: film in slow motion with a sprint timing app (e.g. MySprint) from the same spot every week. Hand timing is off by 0.1–0.2 s, so the app only calls it a new best when you're at least 0.05 s faster." },
    { id: "hill", name: "Hill sprint 15–20 m", unit: "time", sets: 4, maxSets: 6, lo: 1, hi: 1, rest: "2–3 min", cue: "A moderate slope: steep enough to make you lean, not so steep you shuffle. Drive the knees, push the ground back, walk down slowly. Your free version of a heavy sled." },
    { id: "fly20", name: "Flying 20 m sprint", unit: "time", speed: "fly20", sets: 3, maxSets: 5, lo: 1, hi: 1, rest: "4–5 min", cue: "Mark a 25 m build-up zone, then time the next 20 m flat out. Stay tall, feet landing under your hips, relaxed face and shoulders." }] }
];
const FINISHER = { id: "walk", optional: true, name: "Incline treadmill walk (optional)", unit: "cardio", sets: 1, lo: 20, hi: 30, inc: 1, start: 10, maxIncline: 15, rest: "none", cue: "Optional. Skip it on days you'll reach your step goal anyway, such as a work shift or walking home; that keeps sessions short. Otherwise: 2.5 mph at 10–12% incline. Most UK gym treadmills show km/h: 2.5 mph is 4.0 km/h (2.5 km/h is a slow stroll). Hands off the rails. It should feel like a 6 out of 10, able to talk in short sentences. On lower days, drop to 20 min at a lower incline if your legs are fried. Log incline % and minutes." };
const OHTRI = { id: "ohtri", iso: "Every rep: 1 s pause in the bottom stretch behind your head.", name: "Overhead cable triceps extension", sets: 3, lo: 10, hi: 15, inc: 2.5, unit: "load", rest: "90 s", cue: "Face away from the cable with a rope at the bottom, elbows by your ears. Lower until you feel a deep stretch behind your head, then straighten your arms. Training the triceps in this stretched position grew them noticeably more than pushdowns in a 12-week study. No cable? Hold one dumbbell overhead with both hands. Log the stack kg." };
const SUPERSETS = {
  UA: [["hs", "S", "90 s"], ["lsit", "S", "90 s"], ["wpu", "A", "2–3 min"], ["wdip", "A", "2–3 min"], ["ccchin", "B", "2 min"], ["incdb", "B", "2 min"], ["csrow", "C", "2 min"], ["ohtri", "C", "2 min"], ["clat", "D", "60–90 s"], ["hammer", "D", "60–90 s"]],
  UB: [["planche", "S", "2 min"], ["flever", "S", "2 min"], ["wchin", "A", "2 min"], ["wpush", "A", "2 min"], ["wngpu", "B", "90 s"], ["cfly", "B", "90 s"], ["clat", "C", "60–90 s"], ["incurl", "C", "60–90 s"], ["cface", "D", "60 s"], ["ccrunch", "D", "60 s"]],
  LA: [["pogo"], ["sled"], ["wbss"], ["broad"], ["beltsq"], ["drop"], ["nord"]],
  LB: [["hurdle"], ["sldrop"], ["wstep"], ["bound"], ["hlr"], ["wsrdl"], ["wslht", "E", "90 s"], ["slcalf", "E", "90 s"]]
};
const HLR = { ...DEFAULT_DAYS.find(d => d.id === "UA").ex.find(e => e.id === "hlr"), cue: "Ab exercise 1, done straight after the jumps and before the weights, so tired hip flexors can't slow your sprints. Start at bodyweight with bent knees. Once every set hits 12 clean reps, squeeze a light dumbbell between your feet (log it as added kg) and keep adding 1 kg. Curl your pelvis toward your ribs at the top, no swinging." };
DEFAULT_DAYS.forEach(d => {
  const plan = SUPERSETS[d.id];
  if (plan) { const pool = d.ex.concat(d.id === "UA" ? [OHTRI] : d.id === "LB" ? [HLR] : []); d.ex = plan.map(([id, ss, rest]) => { const e = { ...pool.find(x => x.id === id) }; if (ss) { e.ss = ss; e.rest = rest; } return e; }); }
  if (d.kind === "upper") d.ex.push({ ...FINISHER });
  if (d.kind === "lower") d.ex.push({ ...FINISHER, id: "walkL", name: "Incline walk (short, optional)", lo: 15, hi: 20, cue: "Optional, and shorter on leg days so your legs recover for tomorrow. 2.5 mph (4.0 km/h) at 8–10% incline, hands off the rails, easy pace. Log incline % and minutes." });
});
const UNITS = {
  kg: { label: "Belt / added kg", col: "Added kg", sfx: " kg", step: "0.25", ph: "0" },
  load: { label: "Dumbbell kg", col: "Dumbbell kg", sfx: " kg", step: "0.5", ph: "kg" },
  bw: { label: "Bodyweight reps", col: null, sfx: "", step: "1", ph: "" },
  skill: { label: "Skill hold (levels)", col: "Level", sfx: " s", step: "1", ph: "" },
  cm: { label: "Jump height (box/hurdle cm)", col: "Height cm", sfx: " cm", step: "5", ph: "cm" },
  best: { label: "Jump distance (cm)", col: "Distance cm", sfx: " cm", step: "1", ph: "cm" },
  time: { label: "Sprint time (s)", col: "Time s", sfx: " s", step: "0.01", ph: "s" },
  sled: { label: "Sled load (kg)", col: "Sled kg", sfx: " kg", step: "2.5", ph: "kg" },
  cardio: { label: "Cardio (incline %, minutes)", col: "Incline %", sfx: " %", step: "0.5", ph: "%" }
};
const SPEED_TESTS = [
  { id: "10m", name: "10 m from a standing start" },
  { id: "20m", name: "20 m acceleration" },
  { id: "30m", name: "30 m" },
  { id: "fly20", name: "Flying 20 m" },
  { id: "60m", name: "60 m" }
];

/* ---------- state ---------- */
const KEY = "bbl_app_v1";
function blank() {
  return {
    v: 7,
    program: { warmup: clone(DEFAULT_WARMUP), upperWarm: clone(DEFAULT_UPPER_WARM), days: clone(DEFAULT_DAYS) },
    sessions: [], speed: [], body: [],
    food: { targets: { kcal: 2200, protein: 160 }, days: {}, recent: [], shop: {}, beef: true },
    sched: { uni: [], dated: [], work: [], blocked: {}, pinned: {}, icsUrl: "", feeds: [], prefs: { target: 4, earliest: "07:00", latest: "21:30", upper: 80, lower: 100, buffer: 20, bufferUni: 5, when: "afternoon", autoDur: true, walkInPlan: false } },
    steps: {},
    settings: { bw: null, sound: true, installHide: false, aiKey: "", goalW: 72, goalDate: "2027-02-01", lastBackup: null, stepGoal: 10000 },
    deload: { last: null, active: null, snooze: null },
    drafts: {}
  };
}
function fill(def, v) {
  if (v === null || typeof v !== "object" || Array.isArray(v) || def === null || typeof def !== "object" || Array.isArray(def)) return v === undefined ? def : v;
  for (const k of Object.keys(def)) v[k] = fill(def[k], v[k]);
  return v;
}
function load() { try { const v = JSON.parse(localStorage.getItem(KEY)); if (v && v.program) return fill(blank(), v); } catch { } return blank(); }
let S = load();
if ((S.v || 1) < 3) { if (S.v >= 2) { S.program = { warmup: clone(DEFAULT_WARMUP), days: clone(DEFAULT_DAYS) }; S.v = 3; } if (!S.food.targets.kcal) S.food.targets = { kcal: 2200, protein: 160 }; }
if ((S.v || 1) < 2) { S.program = { warmup: clone(DEFAULT_WARMUP), upperWarm: clone(DEFAULT_UPPER_WARM), days: clone(DEFAULT_DAYS) }; S.v = 7; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { } }
if (S.v === 3) { S.program.days = clone(DEFAULT_DAYS); S.drafts = {}; S.v = 5; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { } }
if (S.v === 4) S.v = 5; // v5 reset below covers the leg-raise move
if (S.v === 5) {
  S.sessions.forEach(x => { const e = x.entries?.flever; if (e && (x.meta?.flever?.skill?.[0] || "").startsWith("Tuck")) { e.forEach(y => y.kg = (+y.kg || 0) + 2); if (x.meta.flever) x.meta.flever.skill = DEFAULT_DAYS.find(d => d.id === "UB").ex.find(e => e.id === "flever").skill; } });
  S.program.days = clone(DEFAULT_DAYS); S.drafts = {}; S.v = 6; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { } }
if (S.v === 6) { if (+S.sched.prefs.target === 5) S.sched.prefs.target = 4; S.program.upperWarm = clone(DEFAULT_UPPER_WARM); S.v = 7; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { } }
if (+S.sched.prefs.buffer === 45 && !S.sched.prefs.bufSet) { S.sched.prefs.buffer = 20; S.sched.prefs.bufSet = true; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { toast("Couldn't save. Your phone may be low on storage."); } }

/* program lookups */
const days = () => S.program.days;
const dayById = id => days().find(d => d.id === id);
function getEx(id) { for (const d of days()) { const e = d.ex.find(x => x.id === id); if (e) return { inc: 0, ...e, day: d.id }; } return null; }
function exFor(id, sess) { return getEx(id) || (sess && sess.meta && sess.meta[id] ? { inc: 0, ...sess.meta[id], id } : { id, name: id, unit: "kg", inc: 0 }); }
const lvl = (ex, k) => ex.skill?.[Math.max(0, Math.min(ex.skill.length - 1, Math.round(+k || 0)))] || "";
const kgTxt = k => (+k || 0) === 0 ? "bodyweight" : fmt(k) + " kg";

/* ---------- ui state ---------- */
const ui = { foodSeg: "log", tab: "train", day: null, picked: false, date: todayISO(), progSeg: "lifts", progEx: null, speedTest: "fly20", planWeek: weekStart(todayISO()), foodDate: todayISO(), more: "routine", editEx: null, editDay: null, confirm: null, icsTarget: "uni" };

/* ---------- training logic ---------- */
function sortSessions() { S.sessions.sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || 0) - (a.createdAt || 0)); }
function histFor(exId) { return S.sessions.filter(s => s.entries && s.entries[exId] && s.entries[exId].length); }
function topKg(sets) { return Math.max(...sets.map(s => +s.kg || 0)); }
function e1rm(kg, reps, bw) { const load = (bw ? +bw : 0) + (+kg || 0); return load * (1 + (+reps || 0) / 30); }
const lowerBetter = ex => ex.unit === "time";
function metric(ex, set, bw) {
  if (ex.unit === "kg") return e1rm(set.kg, set.reps, bw);
  if (ex.unit === "load") return e1rm(set.kg, set.reps, 0);
  if (ex.unit === "skill") return (+set.kg || 0) * 1000 + (+set.reps || 0);
  if (ex.unit === "cardio") return +set.reps || 0;
  if (ex.unit === "cm" || ex.unit === "best" || ex.unit === "time" || ex.unit === "sled") return +set.kg || 0;
  return +set.reps || 0;
}
const metricName = ex => ex.unit === "kg" || ex.unit === "load" ? "Est. 1RM" : ex.unit === "cm" ? "Highest" : ex.unit === "best" ? "Best distance" : ex.unit === "time" ? "Fastest" : ex.unit === "sled" ? "Heaviest" : ex.unit === "cardio" ? "Longest walk" : ex.unit === "skill" ? "Best hold" : "Best reps";
const metricSfx = ex => ex.unit === "cardio" ? " min" : ex.unit === "skill" ? " s" : ex.unit === "bw" ? " reps" : ex.unit === "cm" || ex.unit === "best" ? " cm" : ex.unit === "time" ? " s" : " kg";
function setText(ex, x) {
  switch (ex.unit) {
    case "skill": return `${lvl(ex, x.kg)} ${x.reps} s`;
    case "bw": return `${x.reps}`;
    case "best": return `${fmt(x.kg)} cm`;
    case "time": return +x.kg > 0 ? `${(+x.kg).toFixed(2)} s` : "✓";
    case "cm": return `${fmt(x.kg)} cm × ${x.reps}`;
    case "sled": return +x.kg > 0 ? `${fmt(x.kg)} kg` : "✓";
    case "cardio": return `${x.reps} min @ ${fmt(x.kg)}%`;
    case "kg": return (+x.kg || 0) === 0 ? `BW × ${x.reps}` : `+${fmt(x.kg)} × ${x.reps}`;
    default: return `${fmt(x.kg)} × ${x.reps}`;
  }
}
function bestOf(ex, sets) { const v = sets.map(x => metric(ex, x, S.settings.bw)).filter(v => !lowerBetter(ex) || v > 0); if (!v.length) return null; return lowerBetter(ex) ? Math.min(...v) : Math.max(...v); }
function suggest(ex) {
  const h = histFor(ex.id).filter(x => !x.deload), U = UNITS[ex.unit] || UNITS.kg, fill = n => Array(ex.sets).fill(n);
  const range = ex.lo === ex.hi ? `${ex.lo}` : `${ex.lo}–${ex.hi}`;
  if (ex.unit === "time") {
    const times = h.flatMap(s => s.entries[ex.id].map(x => +x.kg || 0)).filter(t => t > 0);
    let count = ex.sets, extra = "";
    if (h.length) { const last = h[0].entries[ex.id]; const lt = last.map(x => +x.kg || 0).filter(t => t > 0); count = Math.max(ex.sets, last.length);
      const steady = lt.length < 2 || (Math.max(...lt) - Math.min(...lt)) / Math.min(...lt) <= 0.03;
      if (steady && last.length >= count && count < (ex.maxSets || ex.sets)) { count++; extra = ` <b>Add a rep:</b> last time you held your speed across all ${last.length}, so do ${count} this time.`; } }
    if (!times.length) return { kg: null, reps: Array(count).fill(1), count, tone: h.length ? "hold" : "new", msg: `Full rest between reps. Time each one with a friend or your phone, or just tick it off.${extra}` };
    return { kg: null, reps: Array(count).fill(1), count, tone: extra ? "up" : "hold", msg: `<b>Beat ${Math.min(...times).toFixed(2)} s.</b> Stop once you're clearly slower than your best of the day.${extra}` };
  }
  if (ex.unit === "sled") {
    const bw = +S.settings.bw || 0;
    if (!h.length) return { kg: bw ? Math.round(bw * 0.4 / 2.5) * 2.5 : null, reps: fill(1), count: ex.sets, tone: "new", msg: `First weeks: start around 40% of your bodyweight${bw ? ` (about ${Math.round(bw * 0.4)} kg on the sled)` : ""}, then build toward very heavy loads that cut your speed roughly in half${bw ? ` (often 50–80% of bodyweight, ${Math.round(bw * 0.5)}–${Math.round(bw * 0.8)} kg)` : ""}.` };
    const last = h[0].entries[ex.id], kg = topKg(last), cap = bw ? bw * 0.8 : Infinity;
    let count = Math.max(ex.sets, last.length);
    if (last.length >= count && kg + (+ex.inc || 5) <= cap) return { kg: kg + (+ex.inc || 5), reps: Array(count).fill(1), count, tone: "up", msg: `<b>Add ${fmt(ex.inc || 5)} kg.</b> You finished all ${last.length} runs at ${fmt(kg)} kg. Keep driving hard; slow but powerful is the goal.` };
    if (last.length >= count && count < (ex.maxSets || ex.sets)) { count++; return { kg, reps: Array(count).fill(1), count, tone: "up", msg: `<b>Add a run.</b> You're near the very-heavy range, so build volume at ${fmt(kg)} kg: ${count} runs this time.` }; }
    return { kg, reps: Array(count).fill(1), count, tone: "hold", msg: `<b>Stay at ${fmt(kg)} kg</b> and complete all ${count} runs.` };
  }
  if (ex.unit === "cardio") {
    const top = ex.maxIncline || 15;
    if (!h.length) return { kg: ex.start || 10, reps: fill(ex.lo), tone: "new", msg: `First time: <b>${ex.lo} min at ${ex.start || 10}% incline</b>, 2.5 mph (4.0 km/h). Add 5 min each session up to ${ex.hi}, then the app raises the incline.` };
    const last = h[0].entries[ex.id], inc = topKg(last), mins = Math.max(...last.map(x => +x.reps || 0));
    if (mins < ex.hi) { const m = Math.min(ex.hi, mins + 5); return { kg: inc, reps: fill(m), tone: "up", msg: `<b>Walk ${m} min</b> at ${fmt(inc)}%. Last time: ${mins} min.` }; }
    if (inc < top) return { kg: inc + (+ex.inc || 1), reps: fill(ex.hi), tone: "up", msg: `<b>Raise the incline to ${fmt(inc + (+ex.inc || 1))}%.</b> You managed ${ex.hi} min at ${fmt(inc)}%.` };
    return { kg: inc, reps: fill(ex.hi), tone: "up", msg: `<b>Top incline reached.</b> Add 0.2 mph (0.3 km/h) to the speed instead, or hold here.` };
  }
  if (ex.unit === "best") {
    if (!h.length) return { kg: null, reps: fill(ex.lo), tone: "new", msg: `First session: measure from the take-off line and log your best distance each set.` };
    const best = Math.max(...h.flatMap(s => s.entries[ex.id].map(x => +x.kg || 0)));
    return { kg: null, reps: fill(ex.lo), tone: "hold", msg: `<b>Beat ${fmt(best)} cm.</b> That's your best so far. Rest fully so every attempt is a real one.` };
  }
  if (ex.unit === "skill") {
    if (!h.length) return { kg: 0, reps: fill(ex.lo), tone: "new", msg: `First session: start at <b>${esc(ex.skill?.[0] || "level 1")}</b> and hold ${ex.lo}–${ex.hi} s per set. If that's easy, pick a harder level.` };
    const last = h[0].entries[ex.id], L = topKg(last), top = last.filter(x => (+x.kg || 0) === L);
    if (top.length >= ex.sets && top.every(x => (+x.reps || 0) >= ex.hi)) {
      if (L < (ex.skill?.length || 1) - 1) return { kg: L + 1, reps: fill(ex.lo), tone: "up", msg: `<b>Move up to ${esc(ex.skill[L + 1])}.</b> You held ${ex.hi} s on every set of ${esc(ex.skill[L])}. Expect shorter holds at first.` };
      return { kg: L, reps: fill(ex.hi), tone: "up", msg: `<b>Top level reached.</b> Keep building hold time on ${esc(lvl(ex, L))}.` };
    }
    return { kg: L, reps: Array.from({ length: ex.sets }, (_, i) => Math.min(ex.hi, (+(top[i]?.reps) || ex.lo) + 2)), tone: "hold", msg: `<b>Stay on ${esc(lvl(ex, L))}</b> and add 1–2 s per set. Last time: ${last.map(x => x.reps + " s").join(" / ")}.` };
  }
  if (ex.unit === "bw") {
    if (!h.length) return { kg: null, reps: fill(ex.lo), tone: "new", msg: `First session: aim for ${range} clean reps a set.` };
    const last = h[0].entries[ex.id];
    if (last.length >= ex.sets && last.every(s => (+s.reps || 0) >= ex.hi)) return { kg: null, reps: fill(ex.lo), tone: "up", msg: `<b>Make it harder.</b> You hit ${ex.hi} on every set, so ${esc(ex.next || "use a harder version")}, and restart at ${ex.lo}.` };
    return { kg: null, reps: Array.from({ length: ex.sets }, (_, i) => Math.min(ex.hi, (+(last[i]?.reps) || ex.lo) + 1)), tone: "hold", msg: `<b>Add a rep where you can.</b> Last time: ${last.map(s => s.reps).join(" / ")}.` };
  }
  if (!h.length) {
    if (ex.unit === "cm") return { kg: ex.start || 30, reps: fill(ex.lo), tone: "new", msg: `First session: start at ${ex.start || 30} cm and focus on quick, quiet contacts.` };
    if (ex.bwStart) return { kg: 0, reps: fill(ex.lo), tone: "new", msg: `First session: start at bodyweight. If ${ex.hi} clean reps is easy, add the belt and pick a load for ${range}.` };
    return { kg: null, reps: fill(ex.lo), tone: "new", msg: `First session: pick a load you can move for ${range} reps with 1–2 left in the tank.` };
  }
  const last = h[0].entries[ex.id], kg = topKg(last), inc = +ex.inc || 0;
  if (inc > 0 && last.length >= ex.sets && last.every(s => (+s.reps || 0) >= ex.hi && (+s.kg || 0) >= kg))
    return { kg: kg + inc, reps: fill(ex.lo), tone: "up", msg: ex.unit === "cm" ? `<b>Raise it ${fmt(inc)} cm.</b> Every set hit ${ex.hi} at ${fmt(kg)} cm. Only keep it if contacts stay fast.` : `<b>Add ${fmt(inc)} kg.</b> You hit ${ex.hi} on every set at ${kgTxt(kg)}, so restart at ${ex.lo} reps.` };
  if (h.length >= 3 && ex.unit !== "cm") {
    const t = s => { const e = s.entries[ex.id]; return { k: topKg(e), r: e.reduce((a, x) => a + (+x.reps || 0), 0) }; };
    const a = t(h[0]), b = t(h[1]), c = t(h[2]);
    if (a.k === b.k && b.k === c.k && a.r <= c.r && kg > 0) { const d = Math.max(0, roundTo(kg * 0.9, ex.unit === "load" ? 0.5 : 1.25));
      return { kg: d, reps: fill(Math.min(ex.hi, ex.lo + 1)), tone: "reset", msg: `<b>Reset to ${fmt(d)} kg.</b> Three sessions at ${fmt(kg)} kg with no extra reps. Build back up from here.` }; }
  }
  const reps = Array.from({ length: ex.sets }, (_, i) => Math.min(ex.hi, (+(last[i]?.reps) || ex.lo) + 1));
  return { kg, reps, tone: "hold", msg: `<b>Stay at ${ex.unit === "kg" && kg === 0 ? "bodyweight" : fmt(kg) + U.sfx}</b> and add a rep where you can. Last time: ${last.map(s => s.reps).join(" / ")}.` };
}
function plates(kg) {
  kg = +kg; if (!(kg > 0)) return "";
  const P = [[25, "p25"], [20, "p20"], [15, "p15"], [10, "p10"], [5, "p5"], [2.5, "p2"], [1.25, "p1"]]; let r = kg, out = [];
  for (const [w, c] of P) { while (r >= w - 1e-9 && out.length < 8) { out.push(`<span class="plate ${c}" title="${w} kg">${w >= 5 ? w : ""}</span>`); r -= w; } }
  return `<span class="plates" aria-label="${fmt(kg)} kg on the belt">${out.join("")}${r > 0.01 ? `<span class="mono muted">+${fmt(r)}</span>` : ""}</span>`;
}
function nextDayId(after) {
  const ids = days().map(d => d.id); if (!ids.length) return null;
  const lastId = after !== undefined ? after : S.sessions[0]?.day;
  const i = ids.indexOf(lastId); return ids[(i + 1) % ids.length] || ids[0];
}
function contactsOf(ex, sets) { const c = +ex.contacts || 0; if (!c) return 0; return sets.reduce((a, x) => a + (ex.unit === "best" ? c : c * (+x.reps || 0)), 0); }
function weekContacts(ws) { const we = addDays(ws, 6); let n = 0; S.sessions.filter(s => s.date >= ws && s.date <= we).forEach(s => Object.entries(s.entries || {}).forEach(([id, sets]) => { n += contactsOf(exFor(id, s), sets); })); return n; }

/* ---------- recovery, deload, volume ---------- */
const READY_Q = [
  { k: "sleep", q: "Sleep last night", o: ["Under 6 h", "6–7½ h", "7½ h +"] },
  { k: "sore", q: "Soreness", o: ["Very sore", "A bit", "Fresh"] },
  { k: "energy", q: "Energy", o: ["Low", "OK", "Good"] }
];
const readyScore = r => r && READY_Q.every(q => r[q.k] !== undefined) ? READY_Q.reduce((a, q) => a + (+r[q.k]), 0) : null;
function readyAdvice(sc, kind) {
  if (sc === null) return null;
  const legsDay = kind === "lower" || kind === "sprint";
  if (sc <= 2) return { tone: "reset", head: "Take it easy today.", body: `The app has taken one set off every lift you haven't started${legsDay ? " and halved the jumps and sprints" : ""}. Keep the same weights and stop each set 3 reps short of failure. If you're this flat two sessions in a row, start a deload week.` };
  if (sc <= 4) return { tone: "hold", head: "Normal session, a bit conservative.", body: `Hit your targets but leave 2 reps in the tank.${legsDay ? " Stop the jumps or sprints as soon as one rep feels slower." : ""}` };
  return { tone: "up", head: "You're recovered. Go for it.", body: "Push for the targets and beat last time where you can." };
}
const isDeloadOn = (d = todayISO()) => !!S.deload.active && d >= S.deload.active && d < addDays(S.deload.active, 7);
function deloadStatus() {
  const t = todayISO(), sess = S.sessions.filter(x => !x.deload), oldest = sess.length ? sess[sess.length - 1].date : null;
  const base = S.deload.last || oldest; if (!base) return { weeks: 0, due: false, early: false, base: null };
  const weeks = Math.floor(dayDiff(base, t) / 7), since = sess.filter(x => x.date >= base).length;
  const recent = S.sessions.map(x => readyScore(x.ready)).filter(v => v !== null).slice(0, 4);
  const lowAvg = recent.length >= 3 && recent.reduce((a, v) => a + v, 0) / recent.length <= 2.5;
  const snoozed = S.deload.snooze && t < S.deload.snooze;
  return { weeks, since, base, due: !isDeloadOn() && !snoozed && weeks >= 6 && since >= 10, early: !isDeloadOn() && !snoozed && weeks >= 3 && weeks < 6 && lowAvg };
}
const isPower = ex => ["time", "cm", "best", "sled"].includes(ex.unit) || +ex.contacts > 0;
const baseCount = (ex, dr) => { const n = suggest(ex).count || ex.sets; if (ex.unit === "cardio") return n;
  if (isDeloadOn()) return Math.max(1, Math.ceil(n / 2));
  const sc = dr ? readyScore(dr.ready) : null; if (sc !== null && sc <= 2) return isPower(ex) ? Math.max(1, Math.ceil(n / 2)) : Math.max(1, n - 1);
  return n; };
function estMin(day) {
  if (!day) return 60;
  let m = day.prep ? 12 : 6;
  const workOf = e => e.unit === "skill" ? 0.5 : e.unit === "time" ? 0.3 : e.unit === "sled" ? 0.5 : 0.75;
  for (let i = 0; i < day.ex.length; i++) {
    const e = day.ex[i];
    if (e.unit === "cardio") { if (!e.optional || S.sched.prefs.walkInPlan) m += +e.hi || 30; continue; }
    if (e.ss) { const g = [e]; while (day.ex[i + 1] && day.ex[i + 1].ss === e.ss) g.push(day.ex[++i]);
      const sets = Math.max(...g.map(x => +x.sets || 3)); m += sets * (restSecs(g[g.length - 1].rest) / 60 + g.reduce((a, x) => a + workOf(x), 0) + 0.3 * (g.length - 1)) + g.length; continue; }
    m += (+e.sets || 3) * (restSecs(e.rest) / 60 + workOf(e)) + 1;
  }
  return Math.ceil(m / 5) * 5;
}
const hm = m => m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`;
function durFor(dayId) { const P = S.sched.prefs, k = kindOf(dayId); return P.autoDur !== false ? estMin(dayById(dayId)) : +(legs(k) ? P.lower : P.upper); }
const MUSCLES = ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Abs", "Quads", "Hamstrings", "Glutes", "Calves"];
const MUSCLE_MAP = {
  hs: { Shoulders: 1 }, lsit: { Abs: 1 }, planche: { Shoulders: 1, Chest: 0.5 }, flever: { Back: 1, Abs: 0.5 },
  wpu: { Back: 1, Biceps: 0.5 }, wdip: { Chest: 1, Triceps: 1, Shoulders: 0.5 }, incdb: { Chest: 1, Shoulders: 0.5, Triceps: 0.5 },
  csrow: { Back: 1, Biceps: 0.5 }, clat: { Shoulders: 1 }, ccchin: { Back: 1, Biceps: 1 }, hammer: { Biceps: 1 }, hlr: { Abs: 1 }, ohtri: { Triceps: 1 },
  wchin: { Back: 1, Biceps: 0.5 }, wpush: { Chest: 1, Triceps: 0.5, Shoulders: 0.5 }, cfly: { Chest: 1 }, wngpu: { Back: 1, Biceps: 0.5 },
  cface: { Shoulders: 1, Back: 0.5 }, incurl: { Biceps: 1 }, ccrunch: { Abs: 1 },
  wbss: { Quads: 1, Glutes: 1 }, beltsq: { Quads: 1, Glutes: 0.5 }, nord: { Hamstrings: 1 }, wstep: { Quads: 1, Glutes: 1 },
  wsrdl: { Hamstrings: 1, Glutes: 1 }, wslht: { Glutes: 1 }, slcalf: { Calves: 1 },
  wirow: { Back: 1, Biceps: 0.5 }, pike: { Shoulders: 1, Triceps: 0.5 }, hkr: { Abs: 1 }, wsbd: { Chest: 1, Triceps: 1 }, ppp: { Chest: 1, Shoulders: 1 }, bfp: { Shoulders: 1 }, dbug: { Abs: 1 }
};
function weekVolume(ws) {
  const we = addDays(ws, 6), v = Object.fromEntries(MUSCLES.map(m => [m, 0])); let cardio = 0;
  S.sessions.filter(x => x.date >= ws && x.date <= we).forEach(x => Object.entries(x.entries || {}).forEach(([id, sets]) => {
    const unit = getEx(id)?.unit || x.meta?.[id]?.unit;
    if (unit === "cardio") { cardio += sets.reduce((a, y) => a + (+y.reps || 0), 0); return; }
    const m = MUSCLE_MAP[id]; if (m) for (const [k, f] of Object.entries(m)) v[k] += f * sets.length;
  }));
  return { v, cardio };
}

/* ---------- schedule + planner ---------- */
function busyFor(date) {
  const d = dow(date), out = [], prev = addDays(date, -1);
  for (const c of S.sched.uni) if (+c.day === d && (!c.from || date >= c.from) && (!c.to || date <= c.to)) out.push({ s: toMin(c.start), e: toMin(c.end), title: c.title || "Uni", type: "uni", id: c.id, src: "uni" });
  for (const c of S.sched.dated) if (c.date === date) out.push({ s: toMin(c.start), e: Math.max(toMin(c.end), toMin(c.start) + 1), title: c.title || (c.type === "work" ? "Work" : "Uni"), type: c.type || "uni", id: c.id, src: "dated" });
  for (const w of S.sched.work) {
    const s = toMin(w.start), e = toMin(w.end);
    if (w.date === date) out.push({ s, e: e <= s ? 1440 : e, title: w.title || "Work", type: "work", id: w.id, src: "work" });
    if (w.date === prev && e <= s && e > 0) out.push({ s: 0, e, title: (w.title || "Work") + " (from yesterday)", type: "work", id: w.id, src: "work" });
  }
  return out.sort((a, b) => a.s - b.s);
}
function hoursOf(list, type) { return list.filter(b => !type || b.type === type).reduce((a, b) => a + (b.e - b.s), 0) / 60; }
function slotFor(date, dur) {
  const P = S.sched.prefs; let lo = toMin(P.earliest), hi = toMin(P.latest);
  if (date === todayISO()) { const n = new Date(); lo = Math.max(lo, Math.ceil((n.getHours() * 60 + n.getMinutes() + 10) / 15) * 15); }
  const busy = busyFor(date).map(b => { const buf = b.type === "work" ? (+P.buffer || 0) : (+P.bufferUni || 0); return { s: b.s - buf, e: b.e + buf }; }).sort((a, b) => a.s - b.s);
  const wins = []; let cur = lo;
  for (const b of busy) { if (b.s > cur) wins.push([cur, Math.min(b.s, hi)]); cur = Math.max(cur, b.e); if (cur >= hi) break; }
  if (cur < hi) wins.push([cur, hi]);
  const ok = wins.filter(w => w[1] - w[0] >= dur);
  if (!ok.length) return null;
  const T = { morning: 0, afternoon: 14 * 60, evening: 1440, any: 0 }[P.when] ?? 0;
  let best = null;
  for (const [a, b] of ok) { const c = Math.min(Math.max(T, a), b - dur); const dist = Math.abs(c - T); if (!best || dist < best.dist) best = { c, a, b, dist }; }
  let st = Math.ceil(best.c / 15) * 15; if (st + dur > best.b) st = Math.floor(best.c / 15) * 15; if (st < best.a) st = best.c;
  return { start: st, end: st + dur };
}
function combos(arr, k) { const out = []; const rec = (i, acc) => { if (acc.length === k) { out.push(acc.slice()); return; } for (let j = i; j < arr.length; j++) { acc.push(arr[j]); rec(j + 1, acc); acc.pop(); } }; rec(0, []); return out; }
const dayDiff = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 864e5);
const kindOf = id => dayById(id)?.kind || "other";
const legs = k => k === "lower" || k === "sprint";
const tcls = k => "t-" + (["upper", "lower", "sprint"].includes(k) ? k : "other");
const planCache = new Map();
function planWeek(ws) {
  if (planCache.has(ws)) return planCache.get(ws);
  const P = S.sched.prefs, dates = [...Array(7)].map((_, i) => addDays(ws, i)), today = todayISO(), we = dates[6];
  const done = S.sessions.filter(s => s.date >= ws && s.date <= we);
  const result = { items: [], short: 0, need: 0, done };
  if (we < today || !days().length) { planCache.set(ws, result); return result; }
  const curWs = weekStart(today);
  let startId = ws === curWs ? nextDayId() : (() => { const pw = planWeek(addDays(ws, -7)); const lastItem = pw.items[pw.items.length - 1]; return lastItem ? nextDayId(lastItem.dayId) : (pw.done.length ? nextDayId(pw.done[0].day) : nextDayId()); })();
  const doneDates = new Set(done.map(s => s.date));
  const pinnedDates = dates.filter(d => S.sched.pinned[d] && d >= today && !doneDates.has(d));
  let need = Math.max(+P.target - done.length, pinnedDates.length, 0);
  result.need = need;
  const cands = dates.filter(d => d >= today && !doneDates.has(d) && !S.sched.blocked[d]);
  const seq = []; let id = startId; for (let i = 0; i < 7; i++) { seq.push(id); id = nextDayId(id); }
  const prevS = S.sessions.find(s => s.date < ws);
  const history = done.map(s => ({ date: s.date, kind: kindOf(s.day) })).concat(prevS ? [{ date: prevS.date, kind: kindOf(prevS.day) }] : []);
  const info = {}; cands.forEach(d => { const b = busyFor(d); const prevB = busyFor(addDays(d, -1)); info[d] = { score: 10 - 0.5 * hoursOf(b) - (hoursOf(b, "work") >= 7 ? 3 : 0), longShiftBefore: hoursOf(prevB, "work") >= 7 }; });
  const slotMemo = {}; const slotOf = (d, id) => { const k = d + "|" + id; if (!(k in slotMemo)) slotMemo[k] = slotFor(d, durFor(id)); return slotMemo[k]; };
  for (let k = Math.min(need, cands.length); k > 0; k--) {
    let best = null;
    for (const c of combos(cands, k)) {
      if (!pinnedDates.every(p => c.includes(p))) continue;
      let score = 0, okAll = true; const items = [];
      c.forEach((d, i) => { const dayId = seq[i], kind = kindOf(dayId), slot = slotOf(d, dayId); if (!slot) { okAll = false; return; } score += info[d].score; if (legs(kind) && info[d].longShiftBefore) score -= 2; items.push({ date: d, dayId, kind, start: slot.start, end: slot.end }); });
      if (!okAll) continue;
      const tl = history.concat(items).sort((a, b) => a.date.localeCompare(b.date));
      for (let i = 1; i < tl.length; i++) { const g = dayDiff(tl[i - 1].date, tl[i].date); if (g === 0) score -= 20; if (g === 1) { score -= 1.5; if (legs(tl[i - 1].kind) && legs(tl[i].kind)) score -= 9; if (i > 1 && dayDiff(tl[i - 2].date, tl[i].date) === 2) score -= 3; } }
      if (!best || score > best.score) best = { score, items };
    }
    if (best) { result.items = best.items; result.short = need - k; result.left = cands.length; planCache.set(ws, result); return result; }
  }
  result.short = need; result.left = cands.length; planCache.set(ws, result); return result;
}
function plannedToday() { const p = planWeek(weekStart(todayISO())); return p.items.find(i => i.date === todayISO()); }
function invalidatePlan() { planCache.clear(); }

/* ---------- ICS import ---------- */
function icsDate(v) {
  const m = String(v).match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/); if (!m || !m[4]) return null;
  if (m[7]) return new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]));
  return new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5]);
}
function parseICS(text) {
  const lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/); const evs = []; let cur = null;
  for (const L of lines) {
    if (L === "BEGIN:VEVENT") cur = { ex: [] };
    else if (L === "END:VEVENT") { if (cur && cur.start) evs.push(cur); cur = null; }
    else if (cur) {
      const i = L.indexOf(":"); if (i < 0) continue; const key = L.slice(0, i).split(";")[0].toUpperCase(), val = L.slice(i + 1);
      if (key === "DTSTART") cur.start = icsDate(val); else if (key === "DTEND") cur.end = icsDate(val);
      else if (key === "SUMMARY") cur.title = val.replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\n/gi, " ").trim();
      else if (key === "RRULE") cur.rrule = val; else if (key === "EXDATE") cur.ex.push(...val.split(",").map(icsDate).filter(Boolean).map(isoOf));
      else if (key === "STATUS" && /CANCELLED/i.test(val)) cur.cancelled = true;
    }
  }
  const out = [], horizonLo = addDays(todayISO(), -14), horizonHi = addDays(todayISO(), 400);
  const push = (st, en, title) => { const d = isoOf(st); if (d < horizonLo || d > horizonHi) return; const e = en && isoOf(en) === d ? en : null; out.push({ date: d, start: toHM(st.getHours() * 60 + st.getMinutes()), end: e ? toHM(e.getHours() * 60 + e.getMinutes()) : "23:59", title: title || "Event" }); };
  for (const ev of evs) {
    if (ev.cancelled) continue;
    const dur = ev.end ? ev.end - ev.start : 3600e3;
    const r = ev.rrule ? Object.fromEntries(ev.rrule.split(";").map(p => p.split("="))) : null;
    if (r && r.FREQ === "WEEKLY") {
      const by = r.BYDAY ? r.BYDAY.split(",").map(x => ["MO", "TU", "WE", "TH", "FR", "SA", "SU"].indexOf(x.slice(-2))) : [(ev.start.getDay() + 6) % 7];
      const until = r.UNTIL ? icsDate(r.UNTIL.length === 8 ? r.UNTIL + "T235959" : r.UNTIL) : null, count = r.COUNT ? +r.COUNT : 1e9, interval = +r.INTERVAL || 1;
      let n = 0; const ws0 = parseISO(weekStart(isoOf(ev.start)));
      for (let w = 0; w < 60 && n < count; w += interval) for (const bd of by.sort()) {
        const d = new Date(ws0); d.setDate(d.getDate() + w * 7 + bd); d.setHours(ev.start.getHours(), ev.start.getMinutes(), 0, 0);
        if (d < ev.start) continue; if (until && d > until) { w = 999; break; } if (n >= count) break; n++;
        if (!ev.ex.includes(isoOf(d))) push(d, new Date(d.getTime() + dur), ev.title);
      }
    } else push(ev.start, ev.end, ev.title);
  }
  const seen = new Set(); return out.filter(e => { const k = e.date + e.start + e.title; if (seen.has(k)) return false; seen.add(k); return true; });
}
function importEvents(list, type) {
  S.sched.dated = S.sched.dated.filter(e => (e.type || "uni") !== type).concat(list.map(e => ({ ...e, id: uid("e"), type })));
  save(); invalidatePlan();
}

async function fetchFeed(url) {
  const r = await fetch(url, { cache: "no-store" }); const text = await r.text();
  if (!/BEGIN:VCALENDAR/.test(text)) throw new Error("not ics"); return parseICS(text);
}
async function refreshFeeds(quiet) {
  let n = 0, failed = 0;
  for (const f of S.sched.feeds) {
    try { const evs = await fetchFeed(f.url); importEvents(evs, f.type); f.last = Date.now(); f.ok = true; n += evs.length; }
    catch { f.ok = false; failed++; }
  }
  save(); invalidatePlan(); render();
  if (!quiet) toast(failed ? "Couldn't refresh one of your calendar links. Check you have signal." : `Updated ${n} events`);
}
/* ---------- photos (IndexedDB) ---------- */
const idb = {
  p: null,
  open() { return this.p || (this.p = new Promise((res, rej) => { const r = indexedDB.open("bbl", 1); r.onupgradeneeded = () => r.result.createObjectStore("photos"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); })); },
  async tx(mode, fn) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction("photos", mode); const req = fn(t.objectStore("photos")); t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error); }); },
  put(k, v) { return this.tx("readwrite", s => s.put(v, k)); }, get(k) { return this.tx("readonly", s => s.get(k)); }, del(k) { return this.tx("readwrite", s => s.delete(k)); }
};
async function compress(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const sc = Math.min(1, 1080 / Math.max(img.naturalWidth, img.naturalHeight)); const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * sc); c.height = Math.round(img.naturalHeight * sc); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(res => c.toBlob(res, "image/jpeg", 0.8));
  } finally { URL.revokeObjectURL(url); }
}
const photoURLs = new Map();
async function hydratePhotos() {
  for (const el of document.querySelectorAll("img[data-photo]")) {
    const k = el.dataset.photo; if (photoURLs.has(k)) { el.src = photoURLs.get(k); continue; }
    try { const b = await idb.get(k); if (b) { const u = URL.createObjectURL(b); photoURLs.set(k, u); el.src = u; } } catch { }
  }
}

/* ---------- graphics: runner, confetti, finish line, lap ---------- */
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const RUNNER = `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="25" cy="7" r="4.2" fill="currentColor"/>
  <path d="M23 12 L17 22 L24 27 L22 36 M17 22 L9 25 M21 14 L28 19 L33 16 M20 15 L12 15 L8 19" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const laneMemo = {};
function animateLane() {
  const r = document.querySelector(".lane-track .run"); if (!r) return;
  const to = +r.dataset.to, key = r.dataset.key, from = laneMemo[key];
  laneMemo[key] = to;
  if (from === undefined || from === to || reduceMotion()) { r.style.left = to + "%"; return; }
  r.style.left = from + "%";
  requestAnimationFrame(() => requestAnimationFrame(() => { r.style.left = to + "%"; r.classList.add("moving"); setTimeout(() => r.classList.remove("moving"), 700); }));
}
function confetti(big) {
  if (reduceMotion()) return;
  const c = document.createElement("canvas"); c.className = "confetti"; document.body.appendChild(c);
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = innerWidth, H = innerHeight; c.width = W * dpr; c.height = H * dpr;
  const g = c.getContext("2d"); g.scale(dpr, dpr);
  const css = getComputedStyle(document.documentElement), cols = ["--upper", "--lower", "--sprint", "--good"].map(v => css.getPropertyValue(v).trim() || "#2447B5").concat(["#ffffff"]);
  const N = big ? 170 : 90, P = [];
  for (let i = 0; i < N; i++) { const left = i % 2 === 0; P.push({ x: left ? -10 : W + 10, y: H * (0.55 + Math.random() * 0.3), vx: (left ? 1 : -1) * (4 + Math.random() * 7), vy: -(9 + Math.random() * 9), w: 6 + Math.random() * 6, h: 10 + Math.random() * 8, r: Math.random() * 6, vr: (Math.random() - .5) * .4, col: cols[i % cols.length] }); }
  let t0 = null;
  const step = ts => { if (!t0) t0 = ts; const el = ts - t0; g.clearRect(0, 0, W, H);
    for (const p of P) { p.vy += 0.32; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.globalAlpha = Math.max(0, 1 - el / 2600); g.fillStyle = p.col; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2))); g.restore(); }
    if (el < 2600) requestAnimationFrame(step); else c.remove(); };
  requestAnimationFrame(step);
}
function showFinish(info) {
  const old = document.getElementById("finish"); if (old) old.remove();
  const el = document.createElement("div"); el.id = "finish"; el.className = "finish " + tcls(info.kind); el.setAttribute("role", "dialog"); el.setAttribute("aria-label", info.name + " finished");
  el.innerHTML = `<div class="finish-card"><div class="chequer" aria-hidden="true"></div>
    <p class="finish-kicker">${esc(niceDate(info.date))}</p><h2 class="finish-title">${esc(info.name)} finished</h2>
    <div class="finish-stats"><div><b>${info.sets}</b><span>sets logged</span></div>${info.contacts ? `<div><b>${info.contacts}</b><span>jump contacts</span></div>` : ""}<div><b>${info.week}</b><span>of ${info.target} this week</span></div></div>
    ${info.prs.length ? `<div class="prs"><p class="prs-head">${info.prs.length === 1 ? "New personal best" : info.prs.length + " new personal bests"}</p>${info.prs.map(p => `<div class="pr">${MEDAL}<span><b>${esc(p.name)}</b><br>${esc(p.text)}</span></div>`).join("")}</div>` : `<p class="finish-note">No new bests this time. Consistent sessions are what make the next ones happen.</p>`}
    <p class="finish-next">Next up: <b>${esc(info.next)}</b></p>
    <button class="btn primary" data-act="closeFinish">Back to training</button></div>`;
  document.body.appendChild(el); el.querySelector("button").focus({ preventScroll: true });
  confetti(info.prs.length > 0);
}
const MEDAL = `<svg class="medal" viewBox="0 0 32 40" aria-hidden="true"><path d="M8 1h6l4 12h-6z" fill="var(--lower)"/><path d="M24 1h-6l-4 12h6z" fill="var(--upper)"/><circle cx="16" cy="26" r="11" fill="var(--sprint)"/><circle cx="16" cy="26" r="7.5" fill="none" stroke="var(--sprint-ink)" stroke-opacity=".35" stroke-width="1.5"/><path d="M16 21.5l1.5 3 3.3.5-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.4-2.3 3.3-.5z" fill="var(--sprint-ink)" fill-opacity=".55"/></svg>`;
const STAD = "M170,40 H240 A60,60 0 0 1 240,160 H100 A60,60 0 0 1 100,40 Z";
const STAD_IN = "M170,11 H240 A89,89 0 0 1 240,189 H100 A89,89 0 0 1 100,11 Z";
function lapSVG(ws, plan) {
  const today = todayISO(); let doneN = 0;
  const segs = [...Array(7)].map((_, i) => {
    const d = addDays(ws, i), dn = S.sessions.find(s => s.date === d), it = plan.items.find(x => x.date === d);
    let col = "var(--sunk)", cls = "";
    if (dn) { col = "var(--good)"; doneN++; } else if (it) { col = `var(--${["upper", "lower", "sprint"].includes(kindOf(it.dayId)) ? kindOf(it.dayId) : "accent"})`; cls = "planned"; }
    return `<path d="${STAD}" pathLength="700" class="seg ${cls}" stroke="${col}" stroke-dasharray="94 606" stroke-dashoffset="${-(i * 100 + 3)}"/>`;
  }).join("");
  const ti = dayDiff(ws, today); const total = plan.items.length + plan.done.length;
  return `<figure class="lap" aria-label="This week as a lap: ${doneN} done, ${plan.items.length} planned">
    <svg viewBox="0 0 340 200">
      <path d="${STAD}" class="track"/>
      ${segs}
      <path d="${STAD}" class="laneline"/>
      <path d="${STAD_IN}" id="lapIn" fill="none" stroke="none"/>
      ${DOW.map((n, i) => `<text class="daylbl ${addDays(ws, i) === today ? "now" : ""}" data-i="${i}" text-anchor="middle" dominant-baseline="middle">${n[0]}</text>`).join("")}
      ${ti >= 0 && ti < 7 ? `<path d="${STAD}" pathLength="700" class="todaymark" stroke-dasharray="0.01 699.99" stroke-dashoffset="${-(ti * 100 + 50)}"/>` : ""}
      <text x="170" y="104" text-anchor="middle" class="lapnum">${doneN} of ${Math.max(+S.sched.prefs.target || 0, total)}</text>
      <text x="170" y="124" text-anchor="middle" class="lapsub">sessions done</text>
    </svg></figure>`;
}
function placeLapLabels() {
  const p = document.getElementById("lapIn"); if (!p || !p.getTotalLength) return; const L = p.getTotalLength();
  document.querySelectorAll(".lap .daylbl").forEach(t => { const pt = p.getPointAtLength(((+t.dataset.i * 100 + 50) / 700) * L); t.setAttribute("x", pt.x.toFixed(1)); t.setAttribute("y", pt.y.toFixed(1)); });
}

/* ---------- meal photos ---------- */
const MEALS = ["Breakfast", "Lunch", "Dinner", "Snack"];
const mealGuess = () => { const h = new Date().getHours(); return h < 11 ? "Breakfast" : h < 15 ? "Lunch" : h < 21 ? "Dinner" : "Snack"; };
const blobToB64 = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(b); });
async function estimateMeal(blob, note) {
  const key = (S.settings.aiKey || "").trim(); if (!key) throw { code: "nokey" };
  const prompt = `Estimate the nutrition of this meal from the photo, for a personal food log.${note ? ` The person says: "${note.slice(0, 300)}".` : ""}
List each distinct food or drink you can see with a realistic portion. Use typical UK portion sizes when unsure.
Reply with only JSON, no other text: {"items":[{"name":"short name","grams":0,"kcal":0,"protein":0}],"notes":"one short sentence on what you were unsure about"}`;
  let r;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: "claude-haiku-5-5", max_tokens: 700, messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: await blobToB64(blob) } }, { type: "text", text: prompt }] }] }) });
  } catch { throw { code: "network" }; }
  if (r.status === 401 || r.status === 403) throw { code: "auth" };
  if (!r.ok) throw { code: "api", status: r.status };
  const j = await r.json(); const text = (j.content || []).map(c => c.text || "").join("");
  const m = text.match(/\{[\s\S]*\}/); if (!m) throw { code: "parse" };
  const o = JSON.parse(m[0]);
  return { items: (o.items || []).slice(0, 12).map(x => ({ name: String(x.name || "Food").slice(0, 60), grams: Math.round(+x.grams || 0), kcal: Math.round(+x.kcal || 0), protein: Math.round((+x.protein || 0) * 10) / 10 })), notes: String(o.notes || "").slice(0, 200) };
}

/* ---------- exercise icons, scroll motion, nav pill ---------- */
const ICONS = {
  cardio: '<svg viewBox="0 0 24 24"><path d="M3 19L21 13"/><circle cx="13" cy="5" r="2"/><path d="M12 8l-2 5 3 2v3M10 13l-3-1M13 9l3 2"/></svg>',
  kg: '<svg viewBox="0 0 24 24"><path d="M4 5h16l-2 4H6z"/><circle cx="12" cy="15" r="5"/><circle cx="12" cy="15" r="1.4"/></svg>',
  load: '<svg viewBox="0 0 24 24"><path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/></svg>',
  bw: '<svg viewBox="0 0 24 24"><circle cx="12" cy="4.5" r="2"/><path d="M12 7v7M7 10l5-2 5 2M9 21l3-7 3 7"/></svg>',
  skill: '<svg viewBox="0 0 24 24"><circle cx="12" cy="19.5" r="2"/><path d="M12 17V9M8 3l4 6 4-6M7 13h10"/></svg>',
  cm: '<svg viewBox="0 0 24 24"><path d="M3 20h18M6 20v-6h5v6M14 20V9h5v11"/><path d="M8 11c1-4 4-6 8-6" stroke-dasharray="2 2.5"/></svg>',
  best: '<svg viewBox="0 0 24 24"><path d="M3 18c3-9 9-9 12 0M15 18c1.5-4 4-4 6 0"/><path d="M3 21h18"/></svg>',
  time: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2M10 2.5h4M18.5 6l1.5-1.5"/></svg>',
  sled: '<svg viewBox="0 0 24 24"><path d="M3 17h13l3-8M6 17V11h7v6M19 9l2-1M3 20h16"/></svg>'
};
const exIcon = ex => `<span class="exicon" aria-hidden="true">${ICONS[ex.unit] || ICONS.kg}</span>`;
let revealIO = null;
let lastRevealKey = "";
function setupReveal() {
  const key = ui.tab + "|" + (ui.tab === "train" ? ui.day : ui.tab === "plan" ? ui.planWeek : ui.tab === "progress" ? ui.progSeg : ui.tab === "more" ? ui.more : ui.foodDate);
  if (key === lastRevealKey) return; lastRevealKey = key;
  if (!("IntersectionObserver" in window) || reduceMotion()) return;
  if (!revealIO) revealIO = new IntersectionObserver(es => { let k = 0; es.forEach(e => { if (e.isIntersecting) { e.target.style.setProperty("--d", (k++ * 70) + "ms"); e.target.classList.add("in"); revealIO.unobserve(e.target); } }); }, { rootMargin: "0px 0px -6% 0px", threshold: 0.06 });
  document.querySelectorAll("#view > section, #view > .lap, #view > figure").forEach(el => { if (el.dataset.rv) return; el.dataset.rv = "1"; el.classList.add("rv"); revealIO.observe(el); });
}
let scrollRAF = 0;
function onScroll() { if (scrollRAF) return; scrollRAF = requestAnimationFrame(() => { scrollRAF = 0; const y = window.scrollY, max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  document.documentElement.style.setProperty("--sp", Math.min(1, y / max).toFixed(3));
  if (!reduceMotion()) document.documentElement.style.setProperty("--scroll", (y * 1.6).toFixed(1) + "px"); }); }
addEventListener("scroll", onScroll, { passive: true });
function placeNavPill() { const tabs = [...document.querySelectorAll("nav.bottom button[data-tab]")], i = tabs.findIndex(b => b.dataset.tab === ui.tab), pill = document.querySelector(".navpill"); if (pill && i >= 0) pill.style.transform = `translateX(${i * 100}%)`; }

/* ---------- rest timer ---------- */
let actx = null, timer = null, tInt = null, wakeLock = null;
function unlockAudio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); } catch { } }
function beep() {
  if (!S.settings.sound || !actx) return;
  try { const t = actx.currentTime; [0, .3, .6].forEach(o => { const osc = actx.createOscillator(), g = actx.createGain(); osc.frequency.value = 880; g.gain.setValueAtTime(.0001, t + o); g.gain.exponentialRampToValueAtTime(.5, t + o + .02); g.gain.exponentialRampToValueAtTime(.0001, t + o + .2); osc.connect(g).connect(actx.destination); osc.start(t + o); osc.stop(t + o + .22); }); } catch { }
  try { navigator.vibrate?.([200, 100, 200]); } catch { }
}
async function keepAwake(on) { try { if (on && "wakeLock" in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener?.("release", () => { wakeLock = null; }); } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; } } catch { } }
function startTimer(secs, what) { timer = { end: Date.now() + secs * 1000, what, fired: false }; $("#timer").hidden = false; $("#timer").classList.remove("done"); keepAwake(true); tick(); clearInterval(tInt); tInt = setInterval(tick, 250); }
function stopTimer() { timer = null; clearInterval(tInt); $("#timer").hidden = true; keepAwake(false); }
function tick() {
  if (!timer) return; const left = Math.round((timer.end - Date.now()) / 1000);
  const a = Math.abs(left); $("#tT").textContent = `${left < 0 ? "+" : ""}${Math.floor(a / 60)}:${pad(a % 60)}`;
  $("#tWhat").textContent = left > 0 ? `Rest · ${timer.what}` : `Go · ${timer.what}`;
  if (left <= 0 && !timer.fired) { timer.fired = true; $("#timer").classList.add("done"); beep(); }
  if (left < -120) stopTimer();
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && timer) { keepAwake(true); tick(); } });

/* ---------- drafts ---------- */
function getDraft(d) { const v = S.drafts[d] || {}; return { ex: v.ex || {}, notes: v.notes || "", warm: v.warm || {}, ready: v.ready || {} }; }
function putDraft(d, v) { S.drafts[d] = v; save(); }
function draftRows(dr, exId) { const ex = getEx(exId); if (!dr.ex[exId]) dr.ex[exId] = Array.from({ length: baseCount(ex, dr) }, () => ({})); return dr.ex[exId]; }

/* ---------- charts ---------- */
function chartSVG(pts, sfx, opts = {}) {
  const W = 640, H = 240, L = 48, R = 16, T = 18, B = 34, iw = W - L - R, ih = H - T - B;
  const ys = pts.map(p => p.y).concat(opts.avg || [], opts.goal != null ? [opts.goal] : []), mn = Math.min(...ys), mx = Math.max(...ys), dec = opts.dec ?? 0;
  const span = mx - mn || Math.max(1, Math.abs(mx) * 0.05); const y0 = mn - span * 0.2, y1 = mx + span * 0.2;
  const X = i => L + (pts.length === 1 ? iw / 2 : i * iw / (pts.length - 1)), Y = v => T + ih - (v - y0) / (y1 - y0) * ih;
  const ticks = [0, 1, 2, 3, 4].map(k => y0 + (y1 - y0) * k / 4);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join("");
  const area = `${line}L${X(pts.length - 1).toFixed(1)},${T + ih}L${X(0).toFixed(1)},${T + ih}Z`;
  const step = Math.max(1, Math.ceil(pts.length / 6)), last = pts[pts.length - 1];
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || "Progress over time")}">
   ${ticks.map(t => `<line x1="${L}" x2="${W - R}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 8}" y="${Y(t) + 4}" text-anchor="end" font-size="11" fill="var(--muted)" font-family="IBM Plex Mono,monospace">${t.toFixed(dec)}</text>`).join("")}
   <path d="${area}" fill="var(--accent)" fill-opacity=".12"/>
   <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="${opts.avg ? 1.5 : 2.5}" stroke-opacity="${opts.avg ? 0.6 : 1}" stroke-linejoin="round"/>
   ${opts.avg ? `<path d="${opts.avg.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join("")}" fill="none" stroke="var(--good)" stroke-width="3" stroke-linejoin="round"/>` : ""}
   ${opts.goal != null ? `<line x1="${L}" x2="${W - R}" y1="${Y(opts.goal)}" y2="${Y(opts.goal)}" stroke="var(--sprint)" stroke-width="2" stroke-dasharray="6 6"/><text x="${L + 6}" y="${Y(opts.goal) - 6}" font-size="12" font-weight="600" fill="var(--sprint)">Goal ${fmt(opts.goal)}${sfx}</text>` : ""}
   ${pts.map((p, i) => `<circle cx="${X(i)}" cy="${Y(p.y)}" r="${i === pts.length - 1 ? 5 : 3}" fill="${i === pts.length - 1 ? "var(--accent)" : "var(--surface)"}" stroke="var(--accent)" stroke-width="2"><title>${niceDate(p.date)}: ${p.y.toFixed(Math.max(dec, 1))}${sfx}</title></circle>`).join("")}
   ${pts.map((p, i) => i % step === 0 || i === pts.length - 1 ? `<text x="${X(i)}" y="${H - 10}" text-anchor="middle" font-size="11" fill="var(--muted)">${shortDate(p.date)}</text>` : "").join("")}
   <text x="${Math.min(X(pts.length - 1), W - R - 4)}" y="${Math.max(12, Y(last.y) - 10)}" text-anchor="end" font-size="12" font-weight="600" fill="var(--fg)">${last.y.toFixed(Math.max(dec, 1))}${sfx}</text>
  </svg>`;
}

/* ---------- render: shell ---------- */
let tt; function toast(m) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => t.hidden = true, 2800); }
function render() {
  const ws = weekStart(todayISO()), n = S.sessions.filter(s => s.date >= ws).length, target = +S.sched.prefs.target || 4;
  const wk = S.sessions.filter(s => s.date >= ws).slice().reverse();
  $("#pips").innerHTML = Array.from({ length: target }, (_, i) => `<span class="pip ${i < n ? "on " + tcls(kindOf(wk[i]?.day)) : ""}"></span>`).join("");
  $("#weekTxt").textContent = `${n}/${target} this week`;
  document.querySelectorAll("nav.bottom button").forEach(b => { if (b.dataset.tab === ui.tab) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  if (!ui.picked || !dayById(ui.day)) { const p = plannedToday(); ui.day = p ? p.dayId : nextDayId(); }
  const v = $("#view");
  v.innerHTML = ui.tab === "train" ? renderTrain() : ui.tab === "plan" ? renderPlan() : ui.tab === "progress" ? renderProgress() : ui.tab === "food" ? renderFood() : renderMore();
  hydratePhotos(); animateLane(); placeLapLabels(); setupReveal(); placeNavPill(); onScroll();
  if (ui.justTick) { const t = document.querySelector(`[data-act="tick"][data-ex="${ui.justTick.ex}"][data-i="${ui.justTick.i}"]`); t?.classList.add("pop"); ui.justTick = null; }
}
function setTab(t) { ui.tab = t; ui.confirm = null; render(); window.scrollTo(0, 0); }

/* ---------- render: train ---------- */
const isStandalone = () => window.navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
function renderTrain() {
  const d = dayById(ui.day);
  if (!d) return `<div class="empty">Your routine has no workouts. Add one under More → Routine.</div>`;
  const dr = getDraft(d.id), nx = nextDayId(), pt = plannedToday();
  const chips = days().map(x => `<button class="chip ${tcls(x.kind)}" data-act="day" data-day="${x.id}" aria-pressed="${x.id === d.id}"><span class="dot"></span>${esc(x.name)}${x.id === nx ? '<span class="nx">next</span>' : ""}</button>`).join("");
  const install = !isStandalone() && !S.settings.installHide ? `<div class="banner"><span class="small"><b>Install the app:</b> in Safari tap Share, then <b>Add to Home Screen</b>.</span><button class="btn ghost sm" data-act="hideInstall">Hide</button></div>` : "";
  const wsT = weekStart(todayISO()), doneWk = S.sessions.filter(x => x.date >= wsT).length, target = +S.sched.prefs.target || 4;
  const totalSets = d.ex.filter(e => !e.optional).reduce((a2, e) => a2 + ((dr.ex[e.id] || []).length || baseCount({ inc: 0, ...e }, dr)), 0) + (d.prep ? S.program.warmup.length : d.kind === "upper" ? (S.program.upperWarm || []).length : 0);
  const doneSets = d.ex.filter(e => !e.optional).reduce((a2, e) => a2 + (dr.ex[e.id] || []).filter(r => r.done).length, 0) + (d.prep ? S.program.warmup : d.kind === "upper" ? (S.program.upperWarm || []) : []).filter(w => dr.warm[w.id]).length;
  const pct = totalSets ? Math.min(100, doneSets / totalSets * 100) : 0;
  const nextPlan = (() => { const p = planWeek(wsT).items.find(i => i.dayId === d.id) || planWeek(addDays(wsT, 7)).items.find(i => i.dayId === d.id); return p; })();
  const when = pt && pt.dayId === d.id ? `Planned today at ${toHM(pt.start)}` : nextPlan ? `Planned ${nextPlan.date === todayISO() ? "today" : niceDate(nextPlan.date)} at ${toHM(nextPlan.start)}` : d.id === nx ? "Your next workout" : "Out of order, that's fine";
  const banner = `<section class="lane ${tcls(d.kind)}" aria-label="${esc(d.name)} progress">
    <div class="lane-no" aria-hidden="true">${Math.min(doneWk + 1, 9)}</div>
    <div class="lane-body"><p class="lane-kicker">${when} · about ${hm(durFor(d.id))}</p><h2 class="lane-title">${esc(d.name)}</h2>${d.focus ? `<p class="lane-focus">${esc(d.focus)}</p>` : ""}</div>
    <div class="lane-track" role="progressbar" aria-valuemin="0" aria-valuemax="${totalSets}" aria-valuenow="${doneSets}"><span class="run" data-key="${d.id}" data-to="${Math.max(4, Math.min(96, pct)).toFixed(1)}" style="left:${Math.max(4, Math.min(96, pct))}%">${RUNNER}</span><span class="fin"></span></div>
    <div class="lane-meta"><span>${doneSets} of ${totalSets} ${d.prep ? "drills and sets" : "sets"} done</span><span>Session ${doneWk + 1} of ${target} this week</span></div>
  </section>`;
  const plannedContacts = d.ex.reduce((a, e) => a + (+e.contacts ? (e.unit === "best" ? e.contacts * e.sets : e.contacts * e.sets * Math.round((e.lo + e.hi) / 2)) : 0), 0);
  const grpOf = ex => ex.ss ? d.ex.filter(e => e.ss === ex.ss) : null;
  const cardList = d.ex.map(ex0 => {
    const ex = { inc: 0, ...ex0 }, s = suggest(ex), U = UNITS[ex.unit] || UNITS.kg, rows = dr.ex[ex.id] || Array.from({ length: baseCount(ex, dr) }, () => ({}));
    const body = rows.map((r, i) => {
      const val = r.kg !== undefined ? r.kg : (s.kg ?? "");
      const vcell = ex.unit === "skill" ? `<td><select id="kg-${ex.id}-${i}" data-ex="${ex.id}" data-i="${i}" data-f="kg" aria-label="Set ${i + 1} level">${(ex.skill || []).map((l, k) => `<option value="${k}" ${+val === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></td>`
        : U.col ? `<td><input id="kg-${ex.id}-${i}" type="number" inputmode="decimal" step="${U.step}" data-ex="${ex.id}" data-i="${i}" data-f="kg" value="${esc(val)}" placeholder="${U.ph}" aria-label="Set ${i + 1} ${U.col}"></td>` : "";
      const rcell = ["best", "time", "sled"].includes(ex.unit) ? "" : `<td><input id="rp-${ex.id}-${i}" type="number" inputmode="numeric" min="0" step="1" data-ex="${ex.id}" data-i="${i}" data-f="reps" value="${esc(r.reps ?? "")}" placeholder="${s.reps[i] ?? ex.lo}" aria-label="Set ${i + 1} reps"></td>`;
      return `<tr class="${r.done ? "done" : ""}"><td>${i + 1}</td>${vcell}${rcell}<td><button class="tick" data-act="tick" data-ex="${ex.id}" data-i="${i}" aria-label="Mark set ${i + 1} done">✓</button></td></tr>`;
    }).join("");
    const head = `<tr><th>${ex.unit === "time" || ex.unit === "sled" ? "Run" : "Set"}</th>${U.col ? `<th>${U.col}</th>` : ""}${["best", "time", "sled"].includes(ex.unit) ? "" : `<th>${ex.unit === "cardio" ? "Minutes" : ex.unit === "skill" ? "Seconds" : ex.contacts === 1 && ex.unit === "bw" ? "Contacts" : "Reps"}</th>`}<th></th></tr>`;
    const grp = grpOf(ex), gi = grp ? grp.findIndex(e => e.id === ex.id) : -1, gLast = grp && gi === grp.length - 1;
    const range = ex.unit === "cardio" ? `${ex.lo}–${ex.hi} min after your last set` : ex.unit === "time" || ex.unit === "sled" ? `${s.count || ex.sets} × ${ex.unit === "sled" ? "20 m" : "sprint"}` : `${ex.sets} × ${ex.lo === ex.hi ? ex.lo : ex.lo + "–" + ex.hi}${ex.unit === "skill" ? " s" : ""}`;
    return `<section class="card ${tcls(d.kind)}">
      <div class="exhead"><h3>${grp ? `<span class="ssb">${esc(ex.ss)}${gi + 1}</span>` : ""}${exIcon(ex)}${ex.unit === "cardio" ? `<span class="sk cardio">${ex.optional ? "Optional" : "Cardio"}</span>` : ex.unit === "skill" ? '<span class="sk">Skill</span>' : ex.unit === "time" ? '<span class="sk sprint">Sprint</span>' : ex.unit === "sled" ? '<span class="sk sled">Sled</span>' : ""}${esc(ex.name)}</h3><span class="rx">${range}${ex.unit === "cardio" ? "" : grp ? (gLast ? `, rest ${esc(ex.rest)} after the pair` : `, then straight into ${esc(grp[gi + 1].name)}`) : `, rest ${esc(ex.rest)}`}</span></div>
      ${ex.cue ? `<p class="cue">${esc(ex.cue)}</p>` : ""}
      ${ex.iso ? `<div class="iso"><span class="lbl">Hold</span><span>${esc(ex.iso)}</span></div>` : ""}
      <div class="target ${s.tone}"><span class="msg">${s.msg}</span>${s.kg && ex.unit === "kg" ? plates(s.kg) : ""}</div>
      <table class="sets"><thead>${head}</thead><tbody>${body}</tbody></table>
      <div class="row"><button class="btn ghost sm" data-act="addset" data-ex="${ex.id}">+ Add set</button>${rows.length > 1 ? `<button class="btn ghost sm" data-act="rmset" data-ex="${ex.id}">− Remove last</button>` : ""}<button class="btn ghost sm" data-act="rest" data-ex="${ex.id}">Start rest timer</button></div>
    </section>`;
  });
  let cards = "";
  for (let i = 0; i < d.ex.length; i++) {
    const e = d.ex[i];
    if (!e.ss) { cards += cardList[i]; continue; }
    const start = i; while (d.ex[i + 1] && d.ex[i + 1].ss === e.ss) i++;
    const g = d.ex.slice(start, i + 1), sets = Math.max(...g.map(x => +x.sets || 3));
    cards += `<div class="ssg"><p class="ssh"><b>Superset ${esc(e.ss)}:</b> one set of ${g.map(x => esc(x.name)).join(", then one set of ")} back to back, then rest ${esc(g[g.length - 1].rest)}. Repeat ${sets} times. Ticking a set jumps you to the next one.</p>${cardList.slice(start, i + 1).join("")}</div>`;
  }
  let warmHTML = "";
  const warm0 = d.prep && S.program.warmup.length ? (() => { const dn = S.program.warmup.filter(w => dr.warm[w.id]).length; return `<section class="card accent"><div class="exhead"><h3>Pelvic-tilt prep</h3><span class="rx">${dn} of ${S.program.warmup.length} done, about 12 min</span></div>
    <p class="cue">Loosen the hip flexors, switch on the glutes and abs, then drill before you sprint. Keep holds to 30 s so you don't lose spring.</p>
    <ul class="wlist">${S.program.warmup.map(w => `<li class="${dr.warm[w.id] ? "done" : ""}"><button class="tick" data-act="warm" data-w="${w.id}" aria-pressed="${!!dr.warm[w.id]}" aria-label="Mark ${esc(w.name)} done">✓</button><div><div class="wname">${esc(w.name)} <span class="rx">${esc(w.dose)}</span></div><p class="cue">${esc(w.cue)}</p></div></li>`).join("")}</ul></section>`; })() : "";
  const lb = S.settings.lastBackup, needBk = S.sessions.length >= 3 && (!lb || dayDiff(lb, todayISO()) >= 30);
  const backupBanner = needBk ? `<div class="banner"><span class="small"><b>Back up your log.</b> Everything lives on this phone only. ${lb ? `Last backup ${niceDate(lb)}.` : "You haven't made a backup yet."} Save it to Files or send it to yourself.</span><button class="btn sm primary" data-act="export">Back up now</button></div>` : "";
  const UW = S.program.upperWarm || [];
  if (d.kind === "upper" && UW.length) { const dn = UW.filter(w => dr.warm[w.id]).length; warmHTML = `<section class="card accent"><div class="exhead"><h3>Wrist and shoulder prep</h3><span class="rx">${dn} of ${UW.length} done, about 5 min</span></div>
    <p class="cue">Warm the joints that take the most load in handstands, planche and dips. Wrist injuries are the most common way calisthenics training gets derailed.</p>
    <ul class="wlist">${UW.map(w => `<li class="${dr.warm[w.id] ? "done" : ""}"><button class="tick" data-act="warm" data-w="${w.id}" aria-pressed="${!!dr.warm[w.id]}" aria-label="Mark ${esc(w.name)} done">✓</button><div><div class="wname">${esc(w.name)} <span class="rx">${esc(w.dose)}</span></div><p class="cue">${esc(w.cue)}</p></div></li>`).join("")}</ul></section>`; }
  const ds = deloadStatus();
  const deloadBanner = isDeloadOn() ? `<div class="banner" style="background:var(--warn-soft)"><span class="small"><b>Deload week until ${niceDate(addDays(S.deload.active, 6))}.</b> Half the sets at the same weights, half the jumps and sprints. The walk stays the same. You'll come back stronger.</span><button class="btn ghost sm" data-act="deloadEnd">End early</button></div>`
    : ds.due || ds.early ? `<div class="banner" style="background:var(--warn-soft)"><span class="small"><b>${ds.due ? "Deload week due." : "Your recovery has been low lately."}</b> ${ds.due ? `It's been ${ds.weeks} weeks of hard training since your ${S.deload.last ? "last deload" : "first logged session"}.` : "Your last few check-ins were low. A lighter week now beats a forced week off later."} A deload is one week of half the sets at the same weights.</span><span class="row"><button class="btn sm primary" data-act="deloadStart">Start deload week</button><button class="btn ghost sm" data-act="deloadSnooze">Next week</button></span></div>` : "";
  const rs = readyScore(dr.ready), adv = readyAdvice(rs, d.kind);
  const readyCard = `<section class="card"><div class="exhead"><h3>Check in</h3><span class="rx">${rs === null ? "3 taps" : `Readiness ${rs}/6`}</span></div>
    ${READY_Q.map(q => `<div class="rq"><span class="small">${q.q}</span><div class="seg" role="group" aria-label="${q.q}">${q.o.map((o, i) => `<button data-act="ready" data-k="${q.k}" data-v="${i}" aria-pressed="${dr.ready[q.k] === i}">${o}</button>`).join("")}</div></div>`).join("")}
    ${adv ? `<div class="target ${adv.tone}"><span class="msg"><b>${adv.head}</b> ${adv.body}</span></div>` : ""}</section>`;
  return `${install}
  <div class="chips" role="group" aria-label="Workout">${chips}</div>
  ${banner}${backupBanner}${deloadBanner}${readyCard}
  <div class="row">
    <div class="field"><label class="lbl" for="date">Date</label><input id="date" type="date" value="${ui.date}"></div>
    <div class="field"><label class="lbl" for="steps">Steps today</label><input id="steps" type="number" inputmode="numeric" step="100" style="width:7em" value="${esc(S.steps[todayISO()] ?? "")}" placeholder="${S.settings.stepGoal}"></div>
    <div class="field"><label class="lbl" for="bw">Bodyweight kg</label><input id="bw" type="number" inputmode="decimal" step="0.1" style="width:7em" value="${esc(S.settings.bw ?? "")}" placeholder="e.g. 75"></div>
  </div>
  <div>${d.note ? `<p class="muted small" style="max-width:65ch">${esc(d.note)} Type what you did, or tap ✓ to accept the grey target. Ticking a set starts the rest timer.</p>` : ""}
  ${plannedContacts ? `<p class="small" style="margin-top:4px"><b>Jump contacts:</b> about <b class="mono">${plannedContacts}</b> today, <b class="mono">${weekContacts(weekStart(todayISO()))}</b> logged this week</p>` : ""}</div>
  ${warmHTML || warm0}${cards}
  <section class="card">
    <label class="lbl" for="notes">Session notes</label>
    <textarea id="notes" placeholder="Sleep, energy, how your hips and hamstrings felt">${esc(dr.notes || "")}</textarea>
    <div class="row"><button class="btn primary" data-act="save">Save ${esc(d.name)} session</button><button class="btn ghost" data-act="cleardraft">Clear entries</button></div>
  </section>`;
}

/* ---------- render: plan ---------- */
function renderPlan() {
  const ws = ui.planWeek, P = S.sched.prefs, plan = planWeek(ws), today = todayISO();
  const label = ws === weekStart(today) ? "This week" : ws === addDays(weekStart(today), 7) ? "Next week" : `Week of ${shortDate(ws)}`;
  const dayCards = [...Array(7)].map((_, i) => {
    const d = addDays(ws, i), busy = busyFor(d), item = plan.items.find(x => x.date === d), dn = S.sessions.filter(s => s.date === d);
    const blocks = [];
    busy.forEach(b => blocks.push([b.s, `<div class="blk ${b.type}"><span class="tm">${toHM(b.s)}–${b.e >= 1440 ? "24:00" : toHM(b.e)}</span><span class="tt">${esc(b.title)}</span>${b.src === "work" || b.src === "dated" ? `<button class="x" data-act="delBusy" data-src="${b.src}" data-id="${b.id}" aria-label="Remove">×</button>` : ""}</div>`]));
    dn.forEach(s => blocks.push([-1, `<div class="blk done"><span class="tm">Done</span><span class="tt">✓ ${esc(dayById(s.day)?.name || s.day)}</span></div>`]));
    if (item) blocks.push([item.start, `<div class="blk train ${tcls(kindOf(item.dayId))}"><span class="tm">${toHM(item.start)}–${toHM(item.end)}</span><span class="tt">${esc(dayById(item.dayId)?.name)}</span></div>`]);
    const sorted = blocks.sort((x, y) => x[0] - y[0]).map(x => x[1]);
    const isPast = d < today;
    return `<section class="card day ${d === today ? "today" : ""} ${item ? "planned " + tcls(kindOf(item.dayId)) : ""}">
      <div class="dayrow"><span class="d">${DOW[i]} <span class="muted" style="font-size:.9rem">${shortDate(d)}</span></span>
      ${isPast ? "" : `<span class="chips"><button class="chip" style="padding:4px 10px;font-size:.78rem" data-act="pin" data-d="${d}" aria-pressed="${!!S.sched.pinned[d]}">Must train</button><button class="chip" style="padding:4px 10px;font-size:.78rem" data-act="block" data-d="${d}" aria-pressed="${!!S.sched.blocked[d]}">No training</button></span>`}</div>
      <div class="blocks">${sorted.length ? sorted.join("") : `<div class="blk rest"><span class="tt">${isPast ? "Nothing logged" : "Free day"}</span></div>`}</div>
      ${isPast ? "" : `<div><button class="btn ghost sm" data-act="addShiftOn" data-d="${d}">+ Shift</button></div>`}
    </section>`;
  }).join("");
  const shiftForm = `<section class="card" id="shiftCard"><h3>Add a work shift</h3>
    <div class="row"><div class="field"><label class="lbl" for="shDate">Date</label><input id="shDate" type="date" value="${ui.shiftDate || addDays(ws, Math.max(0, Math.min(6, dayDiff(ws, today))))}"></div>
    <div class="field"><label class="lbl" for="shStart">Start</label><input id="shStart" type="time" value="${ui.lastShift?.start || "17:00"}"></div>
    <div class="field"><label class="lbl" for="shEnd">End</label><input id="shEnd" type="time" value="${ui.lastShift?.end || "22:00"}"></div>
    <div class="field grow"><label class="lbl" for="shTitle">Job</label><select id="shTitle"><option>Home Bargains</option><option>CBS Arena</option><option>Work</option></select></div></div>
    <div class="row"><button class="btn primary" data-act="addShift">Add shift</button><button class="btn" data-act="copyWeek">Copy this week's shifts to next week</button></div>
    <p class="muted small">Shifts that finish after midnight carry into the next morning.</p></section>`;
  const uniList = S.sched.uni.length ? `<div class="list">${S.sched.uni.slice().sort((a, b) => a.day - b.day || a.start.localeCompare(b.start)).map(c => `<div class="it"><div><b>${DOW[c.day]}</b> <span class="mono">${c.start}–${c.end}</span> · ${esc(c.title)}</div><button class="btn ghost sm" data-act="delUni" data-id="${c.id}">Remove</button></div>`).join("")}</div>` : "";
  const datedUni = S.sched.dated.filter(e => (e.type || "uni") === "uni").length, datedWork = S.sched.dated.filter(e => e.type === "work").length;
  const uniCard = `<section class="card"><h3>Uni timetable and work rota</h3>
    <p class="muted small"><b>Uni:</b> in Outlook on the web (your BCU email), go to Settings → Calendar → Shared calendars → Publish a calendar, choose Calendar and "Can view all details", then Publish and copy the <b>ICS</b> link. Paste it below with "Uni" selected. If "Load link" fails, open the ICS link in Safari to download the file and use "Import calendar file" instead.<br><b>Work:</b> add shifts above, or paste a rota calendar link here with "Work" selected if your work ever gives you one.</p>
    ${S.sched.feeds.length ? `<div class="list">${S.sched.feeds.map(f => `<div class="it"><div><b>${f.type === "work" ? "Work" : "Uni"} link</b> <span class="muted small">${f.ok === false ? "last refresh failed" : f.last ? "updated " + new Date(f.last).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" }) : ""}</span></div><button class="btn ghost sm" data-act="unlink" data-v="${f.type}">Unlink</button></div>`).join("")}</div><div><button class="btn sm" data-act="refreshFeeds">Refresh now</button></div>` : ""}
    <div class="row"><div class="field"><label class="lbl" for="icsTarget">Import into</label><select id="icsTarget"><option value="uni" ${ui.icsTarget === "uni" ? "selected" : ""}>Uni</option><option value="work" ${ui.icsTarget === "work" ? "selected" : ""}>Work</option></select></div><button class="btn" data-act="pickIcs">Import calendar file</button></div>
    <div class="row"><div class="field grow"><label class="lbl" for="icsUrl">Paste a calendar link (updates automatically)</label><input id="icsUrl" type="url" placeholder="webcal:// or https://…ics" value="${esc(S.sched.icsUrl)}"></div><button class="btn" data-act="fetchIcs">Load link</button></div>
    ${datedUni || datedWork ? `<p class="small">${datedUni ? `<b>${datedUni}</b> imported uni events` : ""}${datedUni && datedWork ? " · " : ""}${datedWork ? `<b>${datedWork}</b> imported work events` : ""}. ${ui.confirm === "clearIcs" ? `<span class="confirm">Remove all imported events? <button class="btn danger sm" data-act="clearIcsYes">Remove</button><button class="btn ghost sm" data-act="noconfirm">Keep</button></span>` : `<button class="btn ghost sm" data-act="ask" data-c="clearIcs">Clear imported</button>`}</p>` : ""}
    <details ${S.sched.uni.length ? "open" : ""}><summary class="lbl" style="padding:6px 0">Or add weekly classes by hand ▾</summary>
    <div class="row" style="margin-top:6px"><div class="field"><label class="lbl" for="uDay">Day</label><select id="uDay">${DOW.map((n, i) => `<option value="${i}">${n}</option>`).join("")}</select></div>
    <div class="field"><label class="lbl" for="uStart">Start</label><input id="uStart" type="time" value="09:00"></div>
    <div class="field"><label class="lbl" for="uEnd">End</label><input id="uEnd" type="time" value="11:00"></div>
    <div class="field grow"><label class="lbl" for="uTitle">Class</label><input id="uTitle" type="text" placeholder="e.g. Engineering Maths"></div></div>
    <div class="row"><button class="btn" data-act="addUni">Add class</button></div>${uniList}</details></section>`;
  const prefCard = `<section class="card"><h3>Planner settings</h3>
    <div class="grid2">
      <div class="field"><label class="lbl" for="pTarget">Sessions per week</label><select id="pTarget">${[2, 3, 4, 5, 6].map(n => `<option ${+P.target === n ? "selected" : ""}>${n}</option>`).join("")}</select></div>
      <div class="field"><label class="lbl" for="pWhen">Preferred time</label><select id="pWhen">${[["any", "Earliest free"], ["morning", "Morning"], ["afternoon", "Afternoon"], ["evening", "Evening"]].map(([v, l]) => `<option value="${v}" ${P.when === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      <div class="field"><label class="lbl" for="pEarliest">Gym from</label><input id="pEarliest" type="time" value="${P.earliest}"></div>
      <div class="field"><label class="lbl" for="pLatest">Finish by</label><input id="pLatest" type="time" value="${P.latest}"></div>
      <div class="field ${P.autoDur !== false ? "hidden" : ""}"><label class="lbl" for="pUpper">Upper day (min)</label><input id="pUpper" type="number" inputmode="numeric" value="${P.upper}"></div>
      <div class="field ${P.autoDur !== false ? "hidden" : ""}"><label class="lbl" for="pLower">Lower / sprint day (min)</label><input id="pLower" type="number" inputmode="numeric" value="${P.lower}"></div>
      <div class="field"><label class="lbl" for="pBufUni">Uni travel (min)</label><input id="pBufUni" type="number" inputmode="numeric" value="${P.bufferUni}"></div>
      <div class="field"><label class="lbl" for="pBuffer">Work travel (min)</label><input id="pBuffer" type="number" inputmode="numeric" value="${P.buffer}"></div>
    </div>
    <label class="small" style="display:flex;gap:8px;align-items:center;margin:4px 0 8px"><input id="pAuto" type="checkbox" ${P.autoDur !== false ? "checked" : ""} style="width:20px;height:20px"> Work out session lengths from my routine</label>
    ${P.autoDur !== false ? `<p class="small">${days().map(x => `${esc(x.name)}: about <b>${hm(estMin(x))}</b>`).join("<br>")}</p><p class="muted small">Includes warm-up and rest times${P.walkInPlan ? " and the incline walk" : ", not the optional walk"}. Change a rest time or an exercise and these update.</p>
    <label class="small" style="display:flex;gap:8px;align-items:center;margin:4px 0 8px"><input id="pWalk" type="checkbox" ${P.walkInPlan ? "checked" : ""} style="width:20px;height:20px"> Leave time for the incline walk</label>` : ""}
    <p class="muted small">The planner leaves your travel time free either side of uni (5 min walk) and work, never puts the two lower days back to back, avoids three days in a row, and prefers lighter days. Tap <b>Must train</b> or <b>No training</b> on any day to override it.</p></section>`;
  const summary = plan.items.length || plan.done.length ? `${plan.done.length} done · ${plan.items.length} planned${plan.short > 0 ? ` · <b style="color:var(--warn)">${plan.short} won't fit</b>` : ""}` : (ws < weekStart(today) ? "Past week" : "Nothing planned");
  return `<div class="row" style="justify-content:space-between;align-items:center"><button class="btn sm" data-act="wk" data-v="-7" aria-label="Previous week">‹</button><div style="text-align:center"><h2>${label}</h2><p class="small muted">${summary}</p></div><button class="btn sm" data-act="wk" data-v="7" aria-label="Next week">›</button></div>
  ${ws >= weekStart(today) ? lapSVG(ws, plan) : ""}
  ${plan.short > 0 ? `<div class="banner" style="background:var(--warn-soft)"><span class="small">${plan.left < plan.need ? `${plan.left === 0 ? "No training days left this week" : `Only ${plan.left} day${plan.left === 1 ? "" : "s"} left this week`}, so the rest of your sessions carry on next week.` : `Only ${plan.items.length + plan.done.length} of ${P.target} sessions fit this week. Try a shorter travel buffer, a later finish time, or mark a day <b>Must train</b>.`}</span></div>` : ""}
  <div class="legend"><span><i style="background:var(--uni)"></i>Uni</span><span><i style="background:var(--warn)"></i>Work</span><span><i style="background:var(--upper)"></i>Upper</span><span><i style="background:var(--lower)"></i>Lower</span><span><i style="background:var(--sprint)"></i>Sprint</span><span><i style="background:var(--good)"></i>Done</span></div>
  ${dayCards}${shiftForm}${uniCard}${prefCard}`;
}

/* ---------- render: progress ---------- */
function renderRecovery() {
  const ws = weekStart(todayISO()), cur = weekVolume(ws), prev = weekVolume(addDays(ws, -7)), ds = deloadStatus();
  const bar = (n) => { const c = n === 0 ? "var(--muted)" : n < 10 ? "var(--warn)" : n <= 20 ? "var(--good)" : "var(--upper)"; return `<div class="vbar"><i class="band"></i><i class="fillv" style="width:${Math.min(100, n / 25 * 100)}%;background:${c}"></i></div>`; };
  const rows = MUSCLES.map(m => `<tr><td>${m}</td><td class="vcell">${bar(cur.v[m])}</td><td class="n">${fmt(Math.round(cur.v[m] * 2) / 2)}</td><td class="n muted">${fmt(Math.round(prev.v[m] * 2) / 2)}</td></tr>`).join("");
  const checks = S.sessions.filter(x => readyScore(x.ready) !== null).slice(0, 10);
  const avg = checks.length ? checks.slice(0, 5).reduce((a, x) => a + readyScore(x.ready), 0) / Math.min(5, checks.length) : null;
  const lab = sc => sc <= 2 ? "Low" : sc <= 4 ? "OK" : "Good";
  return `<section class="card"><h3>Deload</h3>
    ${isDeloadOn() ? `<p class="small"><b>You're in a deload week</b> until ${niceDate(addDays(S.deload.active, 6))}.</p>` : ds.base ? `<p class="small">${ds.weeks} week${ds.weeks === 1 ? "" : "s"} of training since your ${S.deload.last ? "last deload" : "first logged session"}. ${ds.due ? "<b>A deload is due.</b>" : ds.weeks >= 6 ? "Due soon, once you've logged a few more sessions." : `Next one due in about ${6 - ds.weeks} week${6 - ds.weeks === 1 ? "" : "s"}.`}</p>` : `<p class="small muted">Log your first session to start the count.</p>`}
    <p class="muted small">Every 6–8 weeks, train for a week with half the sets at the same weights. Fatigue clears and your strength shows up. The app also suggests one early if your check-ins stay low.</p>
    ${isDeloadOn() ? `<button class="btn sm" data-act="deloadEnd">End deload</button>` : `<button class="btn sm" data-act="deloadStart">Start a deload week now</button>`}</section>
  <section class="card"><h3>Readiness check-ins</h3>
    ${checks.length ? `<p class="small">Last ${Math.min(5, checks.length)} average: <b class="mono">${avg.toFixed(1)}/6</b> (${lab(avg)})</p><div class="list">${checks.map(x => { const sc = readyScore(x.ready); return `<div class="it"><div><span class="muted small">${niceDate(x.date)}</span> ${esc(dayById(x.day)?.name || "")}${x.deload ? ' <span class="muted small">deload</span>' : ""}</div><span class="mono" style="color:${sc <= 2 ? "var(--bad)" : sc <= 4 ? "var(--warn)" : "var(--good)"}">${sc}/6</span></div>`; }).join("")}</div>` : `<div class="empty">Tap the 3 check-in questions at the top of your next workout and they'll build up here.</div>`}
    <p class="muted small">Sleep is the big one. Long shifts the day before count too: if you finished a late shift at the arena, expect a lower score and go a bit lighter.</p></section>
  <section class="card"><h3>Hard sets per muscle</h3>
    <div class="tablewrap"><table class="plan vol"><thead><tr><th>Muscle</th><th>This week</th><th class="n">Sets</th><th class="n">Last wk</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="muted small">The shaded band is 10–20 sets, the range most research supports for growth. Amber is under 10, blue is over 20. Compound lifts count fully for the main muscle and half for helpers. Jumps and sprints are tracked as ground contacts instead${S.sessions.length ? `: <b>${weekContacts(ws)}</b> this week` : ""}.</p>
    ${(() => { const wk = [...Array(7)].map((_, i) => addDays(todayISO(), i - 6)), got = wk.filter(x => S.steps[x]); if (!got.length) return `<p class="small">Steps: type them on the Train tab each day, from your watch or the Health app. Goal ${S.settings.stepGoal.toLocaleString()} a day.</p>`; const avg = Math.round(got.reduce((a, x) => a + S.steps[x], 0) / got.length), hit = got.filter(x => S.steps[x] >= S.settings.stepGoal).length;
      return `<p class="small">Steps, last 7 days: average <b class="mono">${avg.toLocaleString()}</b>, goal hit on <b>${hit}</b> of ${got.length} logged days.</p>`; })()}
    <p class="small">Incline walk this week: <b class="mono">${cur.cardio} min</b>${prev.cardio ? ` <span class="muted">(last week ${prev.cardio})</span>` : ""}</p></section>`;
}
function renderProgress() {
  const seg = `<div class="seg" role="group">${[["lifts", "Lifts"], ["speed", "Speed"], ["body", "Body"], ["recovery", "Recovery"]].map(([v, l]) => `<button data-act="seg" data-v="${v}" aria-pressed="${ui.progSeg === v}">${l}</button>`).join("")}</div>`;
  return `<h2>Progress</h2>${seg}` + (ui.progSeg === "speed" ? renderSpeed() : ui.progSeg === "body" ? renderBody() : ui.progSeg === "recovery" ? renderRecovery() : renderLifts());
}
function renderLifts() {
  const all = days().flatMap(d => d.ex.map(e => ({ inc: 0, ...e, day: d.id })));
  const logged = all.filter(e => histFor(e.id).length);
  if (!ui.progEx || !getEx(ui.progEx)) ui.progEx = logged[0]?.id || all[0]?.id;
  if (!ui.progEx) return `<div class="empty">Add exercises to your routine first.</div>`;
  const ex = getEx(ui.progEx), h = histFor(ex.id).slice().reverse(), bw = S.settings.bw, sfx = metricSfx(ex);
  const opts = days().map(d => `<optgroup label="${esc(d.name)}">${d.ex.map(e => `<option value="${e.id}" ${e.id === ui.progEx ? "selected" : ""}>${esc(e.name)}${histFor(e.id).length ? "" : " (no logs)"}</option>`).join("")}</optgroup>`).join("");
  let main;
  const pts = h.map(s => { const e = s.entries[ex.id]; const b = s.bw || bw; const vals = e.map(x => metric(ex, x, b)).filter(v => !lowerBetter(ex) || v > 0); return vals.length ? { date: s.date, y: lowerBetter(ex) ? Math.min(...vals) : Math.max(...vals), kg: topKg(e), reps: e.reduce((a, x) => a + (+x.reps || 0), 0) } : null; }).filter(Boolean);
  if (ex.unit === "skill" && h.length) {
    main = `<div class="tablewrap"><table class="plan"><thead><tr><th>Date</th><th>Level</th><th>Holds</th></tr></thead><tbody>${h.slice().reverse().map(s => { const e = s.entries[ex.id], L = topKg(e); return `<tr><td class="n">${niceDate(s.date)}</td><td>${esc(lvl(ex, L))}</td><td class="n">${e.filter(x => (+x.kg || 0) === L).map(x => x.reps + " s").join(" · ")}</td></tr>`; }).join("")}</tbody></table></div>`;
  } else if (!pts.length) main = `<div class="empty">No results logged for ${esc(ex.name)} yet. Log a ${esc(dayById(ex.day)?.name || "")} session and your trend shows up here.</div>`;
  else {
    const vals = pts.map(p => p.y), best = lowerBetter(ex) ? Math.min(...vals) : Math.max(...vals), first = pts[0], lastp = pts[pts.length - 1];
    const dec = ex.unit === "time" ? 2 : 0;
    const work = ex.unit === "bw" ? `${lastp.reps} reps` : ex.unit === "best" || ex.unit === "time" ? `${lastp.y.toFixed(dec)}${sfx}` : `${ex.unit === "kg" ? "+" : ""}${fmt(lastp.kg)}${UNITS[ex.unit].sfx}`;
    const chg = ex.unit === "bw" ? lastp.reps - first.reps : ex.unit === "best" || ex.unit === "time" ? lastp.y - first.y : lastp.kg - first.kg;
    main = `<div class="stats">
      <div class="stat"><div class="lbl">Latest</div><div class="v mono">${work}</div></div>
      <div class="stat"><div class="lbl">${metricName(ex)}</div><div class="v mono">${best.toFixed(dec || (ex.unit === "kg" || ex.unit === "load" ? 1 : 0))}${sfx}</div></div>
      <div class="stat"><div class="lbl">Change</div><div class="v mono">${chg >= 0 ? "+" : ""}${chg.toFixed(dec || (Number.isInteger(chg) ? 0 : 1))}${ex.unit === "bw" ? " reps" : UNITS[ex.unit].sfx}</div></div>
      <div class="stat"><div class="lbl">Sessions</div><div class="v mono">${pts.length}</div></div></div>
      ${pts.length > 1 ? `<div class="chart">${chartSVG(pts, sfx, { dec })}</div>${lowerBetter(ex) ? `<p class="muted small">Lower is faster.</p>` : ""}` : `<p class="muted small">Log this once more to see a trend line.</p>`}
      ${ex.unit === "kg" ? `<p class="muted small">Estimated 1RM uses the Epley formula on ${bw ? "bodyweight plus belt load" : "belt load only (add your bodyweight on the Train tab to include it)"}.</p>` : ""}`;
  }
  const prs = all.map(e => { const hh = histFor(e.id); if (!hh.length) return ""; let best = null;
    hh.forEach(s => s.entries[e.id].forEach(x => { const v = metric(e, x, s.bw || bw); if (lowerBetter(e) && !(v > 0)) return; if (!best || (lowerBetter(e) ? v < best.v : v > best.v)) best = { v, x, date: s.date }; }));
    if (!best) return "";
    return `<tr><td>${esc(e.name)}</td><td class="n">${setText(e, best.x)}</td><td class="n">${niceDate(best.date)}</td></tr>`; }).join("");
  return `<section class="card"><div class="field"><label class="lbl" for="progEx">Exercise</label><select id="progEx">${opts}</select></div>${main}</section>
  <section class="card"><h3>Personal bests</h3>${prs ? `<div class="tablewrap"><table class="plan"><thead><tr><th>Exercise</th><th>Best</th><th>Date</th></tr></thead><tbody>${prs}</tbody></table></div>` : `<div class="empty">Your best result for every exercise will be listed here once you've logged a session.</div>`}</section>`;
}
function speedPoints(test) {
  const pts = S.speed.filter(x => x.test === test).map(x => ({ date: x.date, y: +x.time, id: x.id, src: "test" }));
  for (const s of S.sessions) for (const [id, sets] of Object.entries(s.entries || {})) { const ex = exFor(id, s); if (ex.speed === test) { const t = sets.map(x => +x.kg || 0).filter(v => v > 0); if (t.length) pts.push({ date: s.date, y: Math.min(...t), src: "session" }); } }
  return pts.sort((a, b) => a.date.localeCompare(b.date));
}
function renderSpeed() {
  const t = ui.speedTest, pts = speedPoints(t), test = SPEED_TESTS.find(x => x.id === t);
  const daily = Object.values(pts.reduce((m, p) => { if (!m[p.date] || p.y < m[p.date].y) m[p.date] = p; return m; }, {})).sort((a, b) => a.date.localeCompare(b.date));
  const best = pts.length ? Math.min(...pts.map(p => p.y)) : null;
  const tests = SPEED_TESTS.map(x => { const p = speedPoints(x.id); const b = p.length ? Math.min(...p.map(q => q.y)) : null; return `<button class="chip" data-act="speedTest" data-v="${x.id}" aria-pressed="${x.id === t}">${esc(x.name.replace(" from a standing start", ""))}${b ? ` <span class="mono">${b.toFixed(2)}</span>` : ""}</button>`; }).join("");
  return `<section class="card"><h3>Log a sprint time</h3>
    <div class="row"><div class="field"><label class="lbl" for="spDate">Date</label><input id="spDate" type="date" value="${todayISO()}"></div>
    <div class="field grow"><label class="lbl" for="spTest">Test</label><select id="spTest">${SPEED_TESTS.map(x => `<option value="${x.id}" ${x.id === t ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></div>
    <div class="field"><label class="lbl" for="spTime">Time (s)</label><input id="spTime" type="number" inputmode="decimal" step="0.01" placeholder="e.g. 2.35" style="width:7em"></div></div>
    <div class="row"><button class="btn primary" data-act="addSpeed">Save time</button></div>
    <p class="muted small">Hand timing reads slower and varies more than timing gates, so use the same method each time. Times from your Lower A and Lower B sprint sets are added here automatically.</p></section>
  <div class="chips">${tests}</div>
  <section class="card"><h3>${esc(test.name)}</h3>
  ${daily.length ? `<div class="stats"><div class="stat"><div class="lbl">Fastest</div><div class="v mono">${best.toFixed(2)} s</div></div><div class="stat"><div class="lbl">Latest</div><div class="v mono">${daily[daily.length - 1].y.toFixed(2)} s</div></div><div class="stat"><div class="lbl">Change</div><div class="v mono">${(daily[daily.length - 1].y - daily[0].y >= 0 ? "+" : "")}${(daily[daily.length - 1].y - daily[0].y).toFixed(2)} s</div></div></div>
    ${daily.length > 1 ? `<div class="chart">${chartSVG(daily, " s", { dec: 2, label: test.name + " times" })}</div><p class="muted small">Lower is faster.</p>` : ""}
    <div class="list">${S.speed.filter(x => x.test === t).slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12).map(x => `<div class="it"><div><span class="mono">${(+x.time).toFixed(2)} s</span> <span class="muted small">${niceDate(x.date)}</span></div><button class="btn ghost sm" data-act="delSpeed" data-id="${x.id}">Delete</button></div>`).join("")}</div>`
    : `<div class="empty">No ${esc(test.name.toLowerCase())} times yet. Log one above or time your sprint sets.</div>`}</section>`;
}
function rollAvg(pts) { return pts.map(p => { const w = pts.filter(q => q.date <= p.date && q.date > addDays(p.date, -7)); return w.reduce((a, q) => a + q.y, 0) / w.length; }); }
function weightTrend(pts) {
  const G = +S.settings.goalW, GD = S.settings.goalDate, t = todayISO();
  const form = `<div class="row"><div class="field"><label class="lbl" for="gW">Goal kg</label><input id="gW" type="number" inputmode="decimal" step="0.5" style="width:6em" value="${esc(G || "")}"></div><div class="field"><label class="lbl" for="gD">By</label><input id="gD" type="date" value="${esc(GD || "")}"></div><button class="btn sm" data-act="saveGoal">Save goal</button></div>`;
  if (pts.length < 2) return `<section class="card"><h3>Goal</h3>${form}<p class="muted small">Weigh in 3–4 mornings a week. After two weeks this shows whether you're on track.</p></section>`;
  const avg = rollAvg(pts), now = avg[avg.length - 1], lastD = pts[pts.length - 1].date;
  const pi = pts.findIndex(p => p.date >= addDays(lastD, -14)), span = Math.max(1, dayDiff(pts[pi].date, lastD));
  const rate = span >= 6 ? (avg[pi] - now) / span * 7 : null;
  const weeksLeft = GD ? Math.max(0.1, dayDiff(t, GD) / 7) : null, need = G && weeksLeft ? (now - G) / weeksLeft : null;
  let verdict = "";
  if (G && now <= G) verdict = `<b style="color:var(--good)">Goal reached.</b> Move to maintenance: add about 300–400 kcal a day and keep training hard.`;
  else if (rate === null) verdict = "Keep weighing in. The trend appears after a week or two of data.";
  else if (rate > 0.75) verdict = `<b style="color:var(--warn)">Losing fast</b> (${rate.toFixed(2)} kg a week). Above about 0.75 kg a week, with this much training, you start losing muscle and speed. Raise your target to about ${(+S.food.targets.kcal || 2200) + 200} kcal, mostly from oats, potatoes or pasta.`;
  else if (need !== null && rate >= need * 0.85) verdict = `<b style="color:var(--good)">On track.</b> Losing ${rate.toFixed(2)} kg a week; you need ${Math.max(0, need).toFixed(2)}.`;
  else if (need !== null) verdict = `<b style="color:var(--warn)">Behind.</b> Losing ${Math.max(0, rate).toFixed(2)} kg a week but you need ${need.toFixed(2)}. Cut 150–200 kcal a day (a little less pasta or oats), or push the goal date back a few weeks${need > 1 ? `; ${need.toFixed(1)} kg a week isn't realistic without losing muscle` : ""}.`;
  return `<section class="card"><h3>Goal</h3><div class="stats">
    <div class="stat"><div class="lbl">7-day average</div><div class="v mono">${now.toFixed(1)} kg</div></div>
    <div class="stat"><div class="lbl">To go</div><div class="v mono">${G ? Math.max(0, now - G).toFixed(1) + " kg" : "–"}</div></div>
    <div class="stat"><div class="lbl">Weekly change</div><div class="v mono">${rate === null ? "–" : (rate >= 0 ? "−" : "+") + Math.abs(rate).toFixed(2) + " kg"}</div></div>
    <div class="stat"><div class="lbl">Weeks left</div><div class="v mono">${weeksLeft ? Math.round(weeksLeft) : "–"}</div></div></div>
    <p class="small">${verdict}</p>${form}</section>`;
}
function renderBody() {
  const list = S.body.slice().sort((a, b) => a.date.localeCompare(b.date));
  const wPts = list.filter(x => +x.weight > 0).map(x => ({ date: x.date, y: +x.weight })), wa = list.filter(x => +x.waist > 0).map(x => ({ date: x.date, y: +x.waist }));
  const photos = list.filter(x => x.photo).slice().reverse();
  return `<section class="card"><h3>Log body stats</h3>
    <div class="row"><div class="field"><label class="lbl" for="bdDate">Date</label><input id="bdDate" type="date" value="${todayISO()}"></div>
    <div class="field"><label class="lbl" for="bdW">Weight kg</label><input id="bdW" type="number" inputmode="decimal" step="0.1" style="width:7em" placeholder="${esc(S.settings.bw ?? "")}"></div>
    <div class="field"><label class="lbl" for="bdWaist">Waist cm</label><input id="bdWaist" type="number" inputmode="decimal" step="0.5" style="width:7em"></div></div>
    <div class="row"><button class="btn primary" data-act="addBody">Save</button><button class="btn" data-act="pickPhoto">Add progress photo</button></div>
    <p class="muted small">Weigh in first thing in the morning, after the toilet and before eating, so the numbers are comparable. Photos stay on this phone only.</p></section>
  ${weightTrend(wPts)}
  <section class="card"><h3>Bodyweight</h3>${wPts.length > 1 ? `<div class="chart">${chartSVG(wPts, " kg", { dec: 1, avg: rollAvg(wPts), goal: +S.settings.goalW || null })}</div><p class="muted small"><span style="color:var(--good)">Green</span> is your 7-day average, which is the number to judge by. Dashed line is your goal.</p>` : wPts.length ? `<p class="mono">${wPts[0].y} kg</p><p class="muted small">Log a second weigh-in to see the trend.</p>` : `<div class="empty">No weigh-ins yet.</div>`}</section>
  ${wa.length ? `<section class="card"><h3>Waist</h3>${wa.length > 1 ? `<div class="chart">${chartSVG(wa, " cm", { dec: 1 })}</div>` : `<p class="mono">${wa[0].y} cm</p>`}</section>` : ""}
  <section class="card"><h3>Progress photos</h3>${photos.length ? `<div class="photos">${photos.map(p => `<figure><img data-photo="${p.id}" alt="Progress photo ${niceDate(p.date)}"><figcaption>${niceDate(p.date)} ${ui.confirm === "ph" + p.id ? `<button class="btn danger sm" data-act="delPhoto" data-id="${p.id}">Delete</button>` : `<button class="btn ghost sm" data-act="ask" data-c="ph${p.id}">×</button>`}</figcaption></figure>`).join("")}</div>` : `<div class="empty">Take the same pose, light and distance every 2–4 weeks so the photos are easy to compare.</div>`}</section>
  ${list.length ? `<section class="card"><h3>Entries</h3><div class="list">${list.slice().reverse().filter(x => x.weight || x.waist).slice(0, 15).map(x => `<div class="it"><div><span class="muted small">${niceDate(x.date)}</span> ${x.weight ? `<span class="mono">${x.weight} kg</span>` : ""} ${x.waist ? `<span class="mono">· ${x.waist} cm</span>` : ""}</div><button class="btn ghost sm" data-act="delBody" data-id="${x.id}">Delete</button></div>`).join("")}</div></section>` : ""}`;
}

/* ---------- meal prep plan ---------- */
const MEALPLAN = [
  { id: "oats", slot: "Breakfast", when: "Every day", name: "Overnight oats", kcal: 620, protein: 34, what: "100 g oats, 200 g fat-free Greek yogurt, 80 g frozen berries, 1 sliced banana, cinnamon, splash of water. Mix in a jar the night before.", why: "High-fibre oats and yogurt fill you up for hours. Banana adds potassium." },
  { id: "box", slot: "Lunch", when: "Every day", name: "Chicken and sweet potato box", kcal: 530, protein: 55, what: "200 g chicken breast (raw weight) with paprika and garlic, 250 g roasted sweet potato, 150 g broccoli or mixed veg plus a handful of spinach, 1 tsp oil.", why: "Big plate, lean protein. Sweet potato is one of the best potassium sources on the list." },
  { id: "bolo", slot: "Dinner", when: "Mon–Thu", name: "Beef bolognese with pasta and konjac", kcal: 530, protein: 38, what: "125 g 5% beef mince, ¼ onion, ¾ tin chopped tomatoes, 100 g frozen veg, herbs. Stir in a handful of frozen spinach. Serve on 75 g wholewheat pasta (dry weight) mixed with ½ pack konjac rice or noodles.", why: "Konjac doubles the bowl for about 10 kcal. Tomatoes add potassium; skip the stock cube or use half." },
  { id: "tray", slot: "Dinner", when: "Fri–Sun", name: "Chicken and potato tray bake", kcal: 570, protein: 58, what: "200 g chicken breast, 350 g potatoes in wedges, 150 g veg, 1 tsp oil, paprika and mixed herbs. 200 °C for 35–40 min.", why: "Boiled or baked potatoes are about the most filling food per calorie there is, and very high in potassium." },
  { id: "snack", slot: "Snack", when: "Every day", name: "2 boiled eggs + yogurt and berries", kcal: 220, protein: 23, what: "2 boiled eggs, 100 g fat-free Greek yogurt with 50 g berries.", why: "Protein between meals keeps hunger down." },
  { id: "chilli", swap: true, slot: "Dinner", when: "Beef swap", name: "Beef chilli with sweet potato", kcal: 580, protein: 40, what: "125 g 5% beef mince, ¼ onion, ½ pepper, ½ tin kidney beans (rinsed), ¾ tin chopped tomatoes, chilli powder, cumin, paprika. Serve on a 250 g baked sweet potato, or konjac rice for about 380 kcal.", why: "Beans add fibre and potassium for pennies. Freezes really well.", extra: "+ kidney beans, 1–2 peppers" },
  { id: "stirfry", swap: true, slot: "Dinner", when: "Beef swap", name: "Beef and broccoli konjac stir-fry", kcal: 470, protein: 38, what: "125 g 5% beef mince browned with garlic and ginger, 200 g broccoli, 100 g mixed veg, 1 pack konjac rice, 150 g sweet potato cubes, 1 tsp oil, 1 tsp reduced-salt soy sauce.", why: "A huge bowl for under 500 kcal. Keep the soy to a teaspoon; it's very salty.", extra: "+ garlic, ginger, reduced-salt soy" },
  { id: "burger", swap: true, slot: "Dinner", when: "Beef swap", name: "Burger bowl", kcal: 490, protein: 37, what: "125 g 5% beef mince shaped into 2 patties, 300 g potato wedges, lettuce, tomato, gherkins. Sauce: 50 g Greek yogurt, mustard and chopped gherkin.", why: "Tastes like a takeaway with none of the salt. Cook patties fresh or reheat in a pan.", extra: "+ lettuce, gherkins, mustard" },
  { id: "fajita", swap: true, slot: "Dinner", when: "Chicken swap", name: "Chicken fajita bowl", kcal: 500, protein: 57, what: "200 g chicken strips, 1 pepper and ½ onion, homemade spice (paprika, cumin, garlic, a pinch of chilli), 1 pack konjac rice, 150 g sweet potato, 50 g Greek yogurt as soured cream, chopped tomato salsa.", why: "Shop fajita kits are full of salt; mixing your own spice fixes that.", extra: "+ peppers" },
  { id: "chpasta", swap: true, slot: "Dinner", when: "Chicken swap", name: "Chicken and tomato pasta", kcal: 560, protein: 56, what: "200 g chicken, 75 g wholewheat pasta (dry) mixed with ½ pack konjac, ½ tin chopped tomatoes, garlic, onion, spinach or frozen veg, herbs. Stir in 50 g Greek yogurt off the heat for a creamy sauce.", why: "Pasta fix that still fits the plan.", extra: "+ spinach (optional)" },
  { id: "eggmuff", swap: true, slot: "Breakfast", when: "Breakfast swap", name: "Egg muffins (2) + fruit", kcal: 260, protein: 14, what: "Bake 12 at once: 12 eggs whisked with chopped peppers, onion, spinach and herbs in a muffin tin, 180 °C for 20 min. Have 2 with a banana. Keeps 4 days in the fridge.", why: "Grab-and-go for early shifts. Add 40 g oats on the side to match the oats breakfast.", extra: "+ 1 extra box of eggs" },
  { id: "topup", slot: "Snack", when: "Training days", name: "Training top-up: banana + 40 g oats", kcal: 255, protein: 6, what: "An extra banana and 40 g oats (porridge or in your overnight oats) on gym and sprint days.", why: "Fuel for sprints and heavy sets without blowing your deficit." }
];
const SHOP = [
  { id: "chk", item: "Frozen chicken breast fillets, 2 × 1 kg", p: 8.50 },
  { id: "mince", item: "Lean 5% beef steak mince, 500 g", p: 5.05, note: "Check the freezer aisle too: frozen lean beef mince is often cheaper per kg" },
  { id: "eggs", item: "Eggs × 15", p: 2.85 },
  { id: "yog", item: "Fat-free Greek-style yogurt, 2 × 1 kg", p: 2.98 },
  { id: "oats", item: "Porridge oats, 1 kg", p: 0.85 },
  { id: "pasta", item: "Wholewheat penne, 500 g", p: 0.69, note: "Same price as white, about twice the fibre" },
  { id: "swp", item: "Sweet potatoes, 2 kg", p: 2.38, mkt: true },
  { id: "pot", item: "White potatoes, 2 kg", p: 1.32, mkt: true },
  { id: "veg", item: "Frozen mixed veg, 1 kg", p: 0.99 },
  { id: "broc", item: "Broccoli (fresh or frozen)", p: 1.19, mkt: true },
  { id: "spin", item: "Frozen spinach, about 1 kg", p: 1.00, note: "Price varies; stir a handful into bolognese, chilli and the chicken boxes" },
  { id: "ban", item: "Bananas × 12", p: 1.92, mkt: true },
  { id: "berry", item: "Frozen summer fruits", p: 1.99 },
  { id: "onion", item: "Onions, 1 kg", p: 0.95, mkt: true },
  { id: "tom", item: "Chopped tomatoes × 3 tins", p: 1.05 },
  { id: "tuna", item: "Tuna chunks in spring water × 6 tins (145 g)", p: 3.90, note: "About 0.63 to 0.65 a tin at Asda, Aldi and Sainsbury's. About 25 g protein per tin for roughly 110 kcal" },
  { id: "lent", item: "Red split lentils, 500 g", p: 2.00, note: "Asda and Tesco 2.00. Cooks in 15 minutes, no soaking" },
  { id: "konjac", item: "Konjac rice or noodles × 2 packs", p: 2.00, note: "Tesco or Sainsbury's in town if Aldi is out" }
];
const PREP = [
  ["Sunday · about 75 min", "Bake 600 g chicken (Mon–Wed lunches) and 2 trays of sweet potato. Cook the bolognese: 4 portions, 2 in the fridge, 2 in the freezer. Boil 8 eggs. Make 3 jars of overnight oats."],
  ["Wednesday · about 45 min", "Bake 800 g chicken for Thu–Sun lunches and roast the rest of the sweet potato. Move the frozen bolognese to the fridge. Boil 6 eggs. Make 4 jars of oats."],
  ["Friday–Sunday · 10 min each", "Tray bake goes in the oven fresh: chop, season, 35–40 min while you shower."],
  ["Food safety", "Cooked chicken and rice keep 3 days in the fridge, which is why the prep is split in two. Reheat until steaming hot."]
];

// ---------- v4.4 food: prices, cooking, cravings ----------
const STORES = [["aldi", "Aldi"], ["asda", "Asda"], ["tesco", "Tesco"], ["sains", "Sainsbury's"], ["morr", "Morrisons"]];
// prices in GBP per pack. qty = packs per week. null = not found in my check, not "free".
const CMP = [
  { item: "Tuna chunks in spring water, 145 g tin", qty: 6, aldi: .65, asda: .63, tesco: .80, sains: .65, morr: null },
  { item: "Chicken breast fillets, 1 kg", qty: 2, aldi: 4.25, asda: 7.00, tesco: 7.00, sains: 6.90, morr: 6.99, note: "Aldi price is the frozen bag (£8.50 for 2 kg), the rest are fresh" },
  { item: "Eggs, 12 medium free range", qty: 1, aldi: 2.49, asda: 2.95, tesco: 2.95, sains: 2.95, morr: 2.95 },
  { item: "Lean beef mince 5%, 500 g", qty: 2, aldi: 5.05, asda: 5.05, tesco: 5.20, sains: 7.00, morr: 5.05 },
  { item: "Porridge oats, 1 kg", qty: 1, aldi: .85, asda: .85, tesco: 1.35, sains: 1.25, morr: null },
  { item: "Red split lentils, 500 g", qty: 1, aldi: null, asda: 2.00, tesco: 2.00, sains: 2.10, morr: 2.10 },
  { item: "Chopped tomatoes, 400 g tin", qty: 3, aldi: .35, asda: .46, tesco: .47, sains: .45, morr: .45 },
  { item: "Wholewheat penne, 500 g", qty: 1, aldi: .69, asda: .77, tesco: .75, sains: .69, morr: null }
];
const gbp = n => "£" + n.toFixed(2);
function renderShopPrices() {
  const shop = S.food.shop || {};
  const best = CMP.map(r => Math.min(...STORES.map(([k]) => r[k]).filter(v => v != null)));
  const rows = CMP.map((r, i) => `<tr><th scope="row">${esc(r.item)}<br><span class="muted small">× ${r.qty} a week</span></th>${STORES.map(([k]) => `<td class="${r[k] != null && r[k] === best[i] ? "lo" : ""}">${r[k] != null ? gbp(r[k]) : "n/a"}</td>`).join("")}</tr>`).join("");
  const tot = STORES.map(([k, n]) => { let t = 0, c = 0; CMP.forEach(r => { if (r[k] != null) { t += r[k] * r.qty; c++; } }); return { n, t, c }; });
  const full = tot.filter(x => x.c === CMP.length).sort((a, b) => a.t - b.t);
  const mix = CMP.reduce((a, r, i) => a + best[i] * r.qty, 0);
  const cards = tot.map(x => `<div class="mp" style="flex:1 1 30%;min-width:96px"><b>${x.n}</b><div class="big">${gbp(x.t)}</div><span class="muted small">${x.c} of ${CMP.length} items</span></div>`).join("");
  const done = SHOP.filter(x => shop[x.id]).length;
  return `<section class="card"><h2>Where to buy: price check</h2>
    <p class="muted small">Prices checked 8 Nov 2026 on Trolley.co.uk and Aldi. They change weekly, so treat them as a guide. Lowest per row is highlighted. "n/a" means I could not find that item at that store, not that it is free. Lidl had no usable data: check the shelf there.</p>
    <div style="overflow-x:auto"><table class="cmp"><thead><tr><th></th>${STORES.map(([, n]) => `<th>${n}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>
    <h3>Weekly total for these 8 items</h3>
    <div style="display:flex;flex-wrap:wrap;gap:8px">${cards}</div>
    <p class="small"><b>Read it like this:</b> a store with fewer than ${CMP.length} items has a lower total only because items are missing. ${full.length ? `Among stores where every item was found, <b>${full[0].n}</b> is cheapest at ${gbp(full[0].t)}.` : "No single store had every item found, so use the mix below."} Buying each item where it is cheapest comes to about <b>${gbp(mix)}</b>, but only do that if the stores are on your route. One cheap store plus the market for veg is usually the sweet spot.</p>
  </section>
  <section class="card"><h2>Shopping checklist</h2>
    <p class="muted small">${done} of ${SHOP.length} ticked. Estimated at ${gbp(SHOP.reduce((a, x) => a + x.p, 0))} for the week, mostly Aldi prices.</p>
    <div class="list shop">${SHOP.map(x => `<label class="it"><span><input type="checkbox" data-act="shopTick" data-id="${x.id}" ${shop[x.id] ? "checked" : ""}> ${esc(x.item)} <b>${gbp(x.p)}</b>${x.mkt ? ' <span class="tag">market</span>' : ""}${x.note ? `<br><span class="muted small">${esc(x.note)}</span>` : ""}</span></label>`).join("")}</div>
    <button class="btn ghost" data-act="shopClear">Reset list</button>
    <p class="muted small">Seasonings (one-off, last months): paprika, garlic granules, cumin, mixed herbs, chilli flakes, curry powder, black pepper, low-sodium stock cubes. Cheapest in the Aldi/Asda spice aisle, about 0.50 to 1.00 each.</p>
  </section>`;
}

const RECIPES = {
  oats: { n: "Protein oats", k: 450, p: 32, t: "5 min", ing: "60 g oats, 150 g fat-free Greek yogurt, 1 banana, 250 ml water or skimmed milk", sea: "cinnamon, pinch of salt", st: ["Microwave oats with the liquid 2 min, stir.", "Stir in the yogurt after cooking so it stays smooth.", "Top with sliced banana and cinnamon."] },
  scramble: { n: "Egg and spinach scramble", k: 420, p: 30, t: "8 min", ing: "3 eggs, big handful frozen spinach, 2 slices wholemeal toast", sea: "black pepper, chilli flakes", st: ["Thaw the spinach in a pan on medium heat and squeeze out the water.", "Beat the eggs, pour in, stir slowly until just set.", "Season and serve on toast."] },
  bowl: { n: "Berry yogurt bowl", k: 360, p: 30, t: "2 min", ing: "250 g fat-free Greek yogurt, 100 g frozen summer fruits, 30 g oats", sea: "cinnamon", st: ["Leave the berries out to soften while you get ready.", "Spoon the yogurt into a bowl, add berries and oats."] },
  tunaspud: { n: "Tuna sweet potato", k: 480, p: 38, t: "10 min active", ing: "1 large sweet potato, 1 tin tuna in spring water, 2 tbsp fat-free yogurt, mixed veg", sea: "paprika, black pepper, lemon if you have it", st: ["Prick the potato, microwave 8 to 10 min until soft.", "Drain the tuna, mix with the yogurt and paprika.", "Split the potato, pile on the tuna and a side of veg."] },
  chbox: { n: "Chicken, sweet potato and broccoli box", k: 520, p: 50, t: "Batch cook Sun", ing: "180 g cooked chicken breast, 250 g sweet potato, 150 g broccoli", sea: "garlic granules, paprika, mixed herbs", st: ["Dice chicken, toss in the seasoning and a little oil spray.", "Roast with sweet potato chunks at 200°C for 25 min.", "Steam the broccoli, portion into boxes. Keeps 4 days in the fridge."] },
  soup: { n: "Lentil, tomato and chicken soup", k: 470, p: 42, t: "25 min", ing: "80 g red lentils, 1 tin chopped tomatoes, 1 onion, 150 g cooked chicken, 500 ml stock", sea: "cumin, garlic granules, chilli flakes", st: ["Soften the onion in a pan with a splash of water.", "Add lentils, tomatoes, stock and spices, simmer 15 min.", "Add the chicken, blitz half if you like it thick."] },
  bolo: { n: "Beef bolognese", k: 650, p: 55, t: "30 min", ing: "150 g 5% beef mince, 1 tin tomatoes, 1 onion, handful spinach, 80 g dry wholewheat penne", sea: "mixed herbs, garlic granules, pepper", st: ["Brown the mince with the onion, no oil needed.", "Add tomatoes, herbs and spinach, simmer 20 min.", "Boil the penne, combine. Makes 4 portions: freeze 2."] },
  fajita: { n: "Chicken fajita tray", k: 560, p: 52, t: "30 min", ing: "200 g chicken breast strips, 1 onion, mixed veg, 1 wholemeal wrap, 2 tbsp yogurt", sea: "paprika, cumin, garlic, chilli", st: ["Toss chicken and veg with the spices.", "Roast on one tray at 210°C for 20 to 25 min.", "Serve in the wrap with a yogurt dollop."] },
  stirfry: { n: "Chicken konjac stir-fry", k: 400, p: 48, t: "15 min", ing: "200 g chicken, frozen veg, 1 pack konjac rice, 1 tsp soy sauce", sea: "garlic, chilli flakes, ginger if you have it", st: ["Rinse the konjac well and dry-fry 2 min to remove the smell.", "Fry the chicken until golden, add veg.", "Add konjac and a little soy. Low in calories, so add a potato or rice on hard training days."] },
  burger: { n: "Beef burgers and wedges", k: 640, p: 52, t: "35 min", ing: "150 g 5% mince, 300 g white potato, side salad", sea: "paprika, onion granules, pepper", st: ["Mix mince with the seasoning, shape 1 patty.", "Roast potato wedges at 210°C for 30 min.", "Grill or pan-fry the patty 4 min a side until cooked through."] },
  curry: { n: "Chicken and lentil curry", k: 580, p: 55, t: "30 min", ing: "180 g chicken, 60 g red lentils, 1 onion, 1 tin tomatoes, spinach", sea: "curry powder, cumin, garlic", st: ["Soften the onion, stir in 2 tsp curry powder for 30 sec.", "Add tomatoes, lentils and 200 ml water, simmer 15 min.", "Add chicken pieces and spinach until cooked. Serve with a small portion of rice or potato."] },
  chilli: { n: "Beef chilli", k: 600, p: 52, t: "35 min", ing: "150 g 5% mince, 1 tin tomatoes, 1 onion, frozen veg, 100 g potato or rice", sea: "chilli, cumin, paprika, pepper", st: ["Brown the mince and onion.", "Add tomatoes, veg, spices, simmer 25 min.", "Serve with the potato or rice. Freezes well."] }
};
const MENU = {
  A: [["Mon", "oats", "chbox", "bolo"], ["Tue", "scramble", "tunaspud", "fajita"], ["Wed", "oats", "chbox", "chilli"], ["Thu", "bowl", "soup", "stirfry"], ["Fri", "scramble", "tunaspud", "burger"], ["Sat", "oats", "chbox", "curry"], ["Sun", "bowl", "soup", "bolo"]],
  B: [["Mon", "scramble", "chbox", "chilli"], ["Tue", "oats", "tunaspud", "curry"], ["Wed", "bowl", "soup", "fajita"], ["Thu", "oats", "chbox", "burger"], ["Fri", "scramble", "tunaspud", "stirfry"], ["Sat", "bowl", "chbox", "bolo"], ["Sun", "oats", "soup", "chilli"]]
};
function recipeCard(id) {
  const r = RECIPES[id];
  return `<details class="rcp"><summary><b>${esc(r.n)}</b> <span class="muted small">≈${r.k} kcal, ${r.p} g protein, ${esc(r.t)}</span></summary>
    <p class="small"><b>You need:</b> ${esc(r.ing)}</p><p class="small"><b>Seasoning:</b> ${esc(r.sea)}</p>
    <ol class="small">${r.st.map(x => `<li>${esc(x)}</li>`).join("")}</ol></details>`;
}
function renderCook() {
  const wk = ui.cookWeek || "A", seg = `<div class="seg" role="group">${["A", "B"].map(v => `<button data-act="cookWeek" data-v="${v}" aria-pressed="${wk === v}">Week ${v}</button>`).join("")}</div>`;
  const days = MENU[wk].map(([d, b, l, n]) => `<div class="mp"><b>${d}</b><br><span class="small">Breakfast: ${esc(RECIPES[b].n)}<br>Lunch: ${esc(RECIPES[l].n)}<br>Dinner: ${esc(RECIPES[n].n)}</span></div>`).join("");
  return `<section class="card"><h2>Two-week rotation</h2>
    <p class="muted small">Same shop, different combinations, so you do not get bored by week 3. Each day lands around 2,000 to 2,300 kcal and 140 to 170 g protein with a snack from the Cravings tab. Calories and protein are estimates (≈), so adjust portions to your weight trend. Beef and chicken only, no pork.</p>
    ${seg}<div class="mpgrid">${days}</div></section>
  <section class="card"><h2>Recipes</h2><p class="muted small">Tap one to open it. Sunday is prep day: cook the chicken box, bolognese and soup base, and the week is mostly reheating.</p>
    ${Object.keys(RECIPES).map(recipeCard).join("")}</section>`;
}
function renderCravings() {
  const tips = [
    ["Protein at every meal", "Aim for 30 to 45 g per meal. Protein is the most filling nutrient, and it protects muscle while you cut."],
    ["Volume for few calories", "Fill half the plate with veg, konjac, potato, broccoli or soup. A big bowl is as satisfying to your stomach as a big plate."],
    ["Fibre and slow carbs", "Oats, wholewheat pasta, lentils, sweet potato. They digest slowly, so hunger comes back later."],
    ["Drink first", "Have a large glass of water before eating, and tea or sparkling water in the evening instead of snacking."],
    ["Eat slowly", "Put the fork down between bites. Fullness takes about 20 minutes to register."],
    ["Sleep 7 to 9 hours", "Short sleep raises hunger and cravings. This is the cheapest fix on the list."],
    ["Plan a treat, don't ban it", "Keep about 200 to 250 kcal a day for something you actually enjoy. Banned foods tend to end in a binge."]
  ];
  const swaps = [["Sweet tooth", "Yogurt with berries and cinnamon, a banana, or 2 squares dark chocolate"], ["Salty or crunchy", "Rice cakes with tuna, air-popped popcorn, cucumber and hot sauce"], ["Late-night hunger", "Fat-free yogurt or a boiled egg. Eat it, then brush your teeth to close the kitchen"], ["Fast-food urge", "Beef burger and wedges from the Cook tab, same flavour for about 640 kcal"]];
  return `<section class="card"><h2>Stay full, keep performing</h2>
    <ul class="small">${tips.map(([a, b]) => `<li><b>${esc(a)}.</b> ${esc(b)}</li>`).join("")}</ul></section>
  <section class="card"><h2>Craving swaps</h2><ul class="small">${swaps.map(([a, b]) => `<li><b>${esc(a)}:</b> ${esc(b)}</li>`).join("")}</ul>
    <h3>Cheap snacks (≈100 to 200 kcal)</h3><p class="small">Tuna on rice cakes (≈130, 25 g protein) · boiled egg (≈75) · fat-free yogurt 150 g (≈80, 15 g protein) · apple or banana · frozen berries.</p></section>
  <section class="card"><h2>Built for a middle-build body</h2>
    <p class="small">You described yourself as in the middle, which is often called a mesomorph build. Be aware that body types are a rough description, not a proven science, so treat this as a sensible starting point and let your own numbers decide.</p>
    <ul class="small"><li><b>Protein:</b> 1.8 to 2.2 g per kg bodyweight, so about 140 to 170 g at your weight.</li><li><b>Carbs:</b> moderate, about 40 to 45% of calories, placed around training. Skip or shrink them on rest days.</li><li><b>Fat:</b> about 25 to 30% of calories, from eggs, mince and a little oil.</li><li><b>Deficit:</b> about 400 to 500 kcal under maintenance, for 0.5 to 0.75 kg a week. Faster loss costs muscle and training quality.</li><li><b>Check weekly:</b> if your 7-day average weight drops over 0.75 kg a week, add 200 kcal. If it stalls for 2 weeks, take off 150 kcal or add 2,000 steps.</li><li><b>Every 8 to 10 weeks:</b> a week at maintenance helps energy and training, and makes the diet easier to keep going.</li></ul></section>`;
}
function renderMealPlan() {
  const beef = S.food.beef !== false, shop = S.food.shop || {};
  const total = SHOP.reduce((a, s) => a + (s.p), 0), left = SHOP.filter(s => !shop[s.id]).length;
  const mealCard = m => `<div class="mp"><div class="mphead"><div><span class="lbl">${m.slot} · ${m.when}</span><h4>${esc(m.name)}</h4></div><span class="mono small">${m.kcal} kcal<br>${m.protein} g</span></div>
    <p class="small">${esc(m.what)}</p><p class="muted small">${esc(m.why)}${m.extra ? ` Shopping: ${esc(m.extra)}.` : ""}</p><button class="btn sm" data-act="logMeal" data-id="${m.id}">Log to ${ui.foodDate === todayISO() ? "today" : niceDate(ui.foodDate)}</button></div>`;
  const swaps = MEALPLAN.filter(m => m.swap).map(mealCard).join("");
  const meals = MEALPLAN.filter(m => !m.swap).map(m => `<div class="mp"><div class="mphead"><div><span class="lbl">${m.slot} · ${m.when}</span><h4>${esc(m.name)}</h4></div><span class="mono small">${m.kcal} kcal<br>${m.protein} g</span></div>
    <p class="small">${esc(m.what)}</p><p class="muted small">${esc(m.why)}</p><button class="btn sm" data-act="logMeal" data-id="${m.id}">Log to ${ui.foodDate === todayISO() ? "today" : niceDate(ui.foodDate)}</button></div>`).join("");
  return `<section class="card"><h3>Your fat-loss plan</h3>
    <p class="small">About <b>2,200 kcal and 160 g protein</b> a day. With your training, shifts on your feet and 10,000 steps, that's likely a deficit of 600–900 kcal, so expect 0.5–0.75 kg a week. If Progress → Body says you're losing faster than 0.75 kg a week, go up to 2,400. From 76–78 kg that lands you in the low 70s by late January or February.</p>
    <p class="muted small">Weigh yourself 3–4 mornings a week and watch the weekly average, not single days. If the average hasn't dropped after 2 weeks, cut 150–200 kcal (less pasta or oats). If your sprint times or lifts drop off badly, add the top-up back in. Face fat comes off with overall fat loss; there's no way to target it directly, but less salt, more water and good sleep make your face look less puffy within days.</p></section>
  <section class="card"><h3>Daily meals</h3><p class="muted small">The base plan is about 1,900–2,000 kcal; the training top-up and cooking extras bring it to about 2,200.</p>${meals}</section>
  <section class="card"><h3>Rotate your meals</h3><p class="small">Same meals every week gets boring fast. Each week, swap the bolognese for one beef dinner and the tray bake for one chicken dinner. Every swap uses the same 500 g of beef or 2 kg of chicken, so the shop barely changes: usually £1–2 extra.</p>
    <ol class="rules small"><li><b>Week 1:</b> bolognese + tray bake</li><li><b>Week 2:</b> beef chilli + fajita bowl</li><li><b>Week 3:</b> burger bowl + chicken tomato pasta</li><li><b>Week 4:</b> beef stir-fry + tray bake</li></ol>${swaps}</section>
  <section class="card"><h3>Prep schedule</h3><ol class="rules">${PREP.map(([h, t]) => `<li><b>${h}:</b> ${t}</li>`).join("")}</ol></section>
  <section class="card"><h3>Weekly shop</h3>
    <p class="small"><b>Aldi, High Street, Aston (B19 2SS)</b> is the closest cheap supermarket to your uni. For fruit, veg and potatoes, <b>Bullring Indoor and Open Market</b> (Edgbaston Street, B5) usually sells £1 bowls that beat supermarket prices.</p>
    <div class="list shop">${SHOP.map(s => `<label class="it"><span><input type="checkbox" data-act="shopTick" data-id="${s.id}" ${shop[s.id] ? "checked" : ""}> ${esc(s.item)}${s.mkt ? ' <span class="tag">market</span>' : ""}${s.note ? `<br><span class="muted small">${esc(s.note)}</span>` : ""}</span><span class="mono">£${(s.p).toFixed(2)}</span></label>`).join("")}</div>
    <p class="small"><b>Total ≈ £${total.toFixed(2)}</b> at Aldi online prices (shop prices vary). Buying the items marked “market” at the Bullring usually brings it down to about £32. To get nearer £30, buy frozen lean beef mince when it's on offer, or skip the frozen fruit and use bananas. ${left === 0 ? "All ticked off." : `${left} left to buy.`}</p>
    <p class="muted small">First shop only: spray oil, paprika, garlic granules, mixed herbs and cinnamon, about £4–5, and they last for weeks.</p>
    <div class="row"><button class="btn sm ghost" data-act="shopClear">Untick everything</button></div></section>
  <section class="card"><h3>Why these foods</h3><ul class="rules">
    <li><b>Whole or barely processed:</b> everything on the list is a single ingredient except the yogurt (milk and cultures), wholewheat pasta (flour and water) and konjac.</li>
    <li><b>High volume, low calorie:</b> potatoes, sweet potatoes, veg, spinach, berries and konjac fill the plate for very few calories. Boiled potatoes came out as the most filling food per calorie in a classic satiety study.</li>
    <li><b>Nutrient dense:</b> chicken, lean beef, eggs and yogurt for protein, iron, zinc and B12; spinach, broccoli and berries for vitamins C and K, folate and fibre; potatoes, bananas, beans and tomatoes for potassium; oats for slow-release carbs and fibre.</li>
    <li><b>The one exception:</b> konjac is nearly empty nutritionally. It's there purely to make bowls bigger. Skip it any week money is tight; just add more veg.</li></ul></section>
  <section class="card"><h3>Debloat and potassium</h3><ul class="rules">
    <li><b>Salt:</b> keep it under 6 g a day (NHS limit). Most of it hides in processed food, stock cubes, sauces and takeaways, not the salt shaker. Season with herbs, garlic, paprika, lemon and black pepper instead.</li>
    <li><b>Potassium:</b> potatoes, sweet potatoes, bananas, tomatoes, yogurt, spinach and beans help your body balance sodium. This plan is built around them.</li>
    <li><b>Drinks:</b> water only. A 500 ml fizzy drink is about 200 kcal of sugar; swap it for sparkling water with lemon if you miss the fizz.</li>
    <li><b>Konjac:</b> rinse it well, then dry-fry for 2–3 min before mixing it in, which gets rid of the smell and the rubbery texture.</li></ul></section>`;
}
/* ---------- render: food ---------- */
function renderFood() {
  const d = ui.foodDate, T = S.food.targets, items = S.food.days[d] || [], bw = +S.settings.bw || null;
  const kcal = items.reduce((a, x) => a + (+x.kcal || 0), 0), pro = items.reduce((a, x) => a + (+x.protein || 0), 0);
  const barH = (v, t) => t ? `<div class="bar ${v >= t ? "over" : ""}"><i style="width:${Math.min(100, v / t * 100)}%"></i></div>` : "";
  const week = [...Array(7)].map((_, i) => addDays(d, i - 6)).map(x => { const it = S.food.days[x] || []; return { d: x, k: it.reduce((a, y) => a + (+y.kcal || 0), 0), p: it.reduce((a, y) => a + (+y.protein || 0), 0), n: it.length }; });
  const fseg = `<div class="seg" role="group">${[["log", "Log"], ["plan", "Plan"], ["shop", "Shop"], ["cook", "Cook"], ["crave", "Cravings"]].map(([v, l]) => `<button data-act="foodSeg" data-v="${v}" aria-pressed="${ui.foodSeg === v}">${l}</button>`).join("")}</div>`;
  if (ui.foodSeg === "plan") return fseg + renderMealPlan();
  if (ui.foodSeg === "shop") return fseg + renderShopPrices();
  if (ui.foodSeg === "cook") return fseg + renderCook();
  if (ui.foodSeg === "crave") return fseg + renderCravings();
  return fseg + `<div class="row" style="justify-content:space-between;align-items:center"><button class="btn sm" data-act="fd" data-v="-1" aria-label="Previous day">‹</button><div style="text-align:center"><h2>${d === todayISO() ? "Today" : niceDate(d)}</h2></div><button class="btn sm" data-act="fd" data-v="1" aria-label="Next day">›</button></div>
  <section class="card">
    <div class="stats"><div class="stat"><div class="lbl">Calories</div><div class="v mono">${kcal}${T.kcal ? `<span class="muted" style="font-size:1rem"> / ${T.kcal}</span>` : ""}</div>${barH(kcal, T.kcal)}</div>
    <div class="stat"><div class="lbl">Protein</div><div class="v mono">${pro} g${T.protein ? `<span class="muted" style="font-size:1rem"> / ${T.protein}</span>` : ""}</div>${barH(pro, T.protein)}</div></div>
  </section>
  ${renderSnap()}
  <section class="card"><h3>Add food</h3>
    <div class="row"><div class="field grow"><label class="lbl" for="fName">Food</label><input id="fName" type="text" placeholder="e.g. Chicken wrap"></div>
    <div class="field"><label class="lbl" for="fK">kcal</label><input id="fK" type="number" inputmode="numeric" style="width:6em"></div>
    <div class="field"><label class="lbl" for="fP">Protein g</label><input id="fP" type="number" inputmode="decimal" style="width:6em"></div></div>
    <div class="row"><button class="btn primary" data-act="addFood">Add</button></div>
    ${S.food.recent.length ? `<div><p class="lbl" style="margin-bottom:6px">Quick add</p><div class="chips">${S.food.recent.slice(0, 10).map((r, i) => `<button class="chip" data-act="quickFood" data-i="${i}">${esc(r.name)} <span class="mono muted">${r.kcal}·${r.protein}g</span></button>`).join("")}</div></div>` : ""}
  </section>
  <section class="card"><h3>Eaten</h3>${items.length ? renderEaten(items) : `<div class="empty">Nothing logged for this day. Snap your next meal or add it above.</div>`}</section>
  <section class="card"><h3>Last 7 days</h3><div class="tablewrap"><table class="plan"><thead><tr><th>Day</th><th>kcal</th><th>Protein</th></tr></thead><tbody>${week.map(w => `<tr><td>${niceDate(w.d)}</td><td class="n">${w.n ? w.k : "–"}</td><td class="n">${w.n ? w.p + " g" : "–"}</td></tr>`).join("")}</tbody></table></div></section>
  <section class="card"><h3>Daily targets</h3>
    <div class="row"><div class="field"><label class="lbl" for="tK">Calories</label><input id="tK" type="number" inputmode="numeric" style="width:7em" value="${esc(T.kcal ?? "")}"></div>
    <div class="field"><label class="lbl" for="tP">Protein g</label><input id="tP" type="number" inputmode="numeric" style="width:7em" value="${esc(T.protein ?? "")}"></div><button class="btn" data-act="saveTargets">Save targets</button></div>
    <p class="muted small">${bw ? `At ${bw} kg, a common protein target for strength and speed training is 1.6–2.2 g per kg, so about <b>${Math.round(bw * 1.6)}–${Math.round(bw * 2.2)} g</b> a day. ` : "Add your bodyweight on the Train tab for a protein suggestion. "}For calories, start from a rough guess, then adjust by about 200 a day based on whether your weekly average weight is moving the way you want.</p></section>`;
}

function renderEaten(items) {
  const groups = {}; items.forEach(x => { const k = x.meal || "Other"; (groups[k] = groups[k] || []).push(x); });
  const order = MEALS.concat(["Other"]).filter(k => groups[k]);
  return order.map(k => { const g = groups[k], photo = g.find(x => x.photo)?.photo, kc = g.reduce((a, x) => a + (+x.kcal || 0), 0), pr = g.reduce((a, x) => a + (+x.protein || 0), 0);
    return `<div class="meal">${photo ? `<img class="mealthumb" data-photo="${photo}" alt="${esc(k)} photo">` : `<div class="mealthumb none" aria-hidden="true"></div>`}
      <div class="mealbody"><div class="mealhead"><b>${esc(k)}</b><span class="muted small">${kc} kcal, ${Math.round(pr * 10) / 10} g protein</span></div>
      <div class="list">${g.map(x => `<div class="it"><div>${esc(x.name)} <span class="muted small">${x.kcal || 0} kcal, ${x.protein || 0} g</span></div><button class="btn ghost sm" data-act="delFood" data-id="${x.id}" aria-label="Delete ${esc(x.name)}">×</button></div>`).join("")}</div></div></div>`; }).join("");
}
function renderSnap() {
  const m = ui.snap, hasKey = !!(S.settings.aiKey || "").trim();
  if (!m) return `<section class="card snap"><div class="snaphead"><div><h3>Snap a meal</h3><p class="muted small">${hasKey ? "Take a photo and the app estimates calories and protein. Check the numbers before adding." : "Take a photo to log it with your meal. Turn on calorie estimates from photos in More → Settings."}</p></div></div>
    <div class="row"><button class="btn primary" data-act="snapCam">Take photo</button><button class="btn" data-act="snapLib">Choose from photos</button></div></section>`;
  const rows = m.items.map((x, i) => `<div class="snaprow"><input id="sn-n-${i}" type="text" value="${esc(x.name)}" aria-label="Food name"><input id="sn-k-${i}" type="number" inputmode="numeric" value="${x.kcal}" aria-label="kcal"><input id="sn-p-${i}" type="number" inputmode="decimal" value="${x.protein}" aria-label="Protein g"><button class="btn ghost sm" data-act="snapDel" data-i="${i}" aria-label="Remove">×</button></div>`).join("");
  const tk = m.items.reduce((a, x) => a + (+x.kcal || 0), 0), tp = m.items.reduce((a, x) => a + (+x.protein || 0), 0);
  return `<section class="card snap"><div class="snapgrid"><img class="snapimg" data-photo="${m.id}" alt="Meal photo"><div class="snapside">
      <div class="field"><label class="lbl" for="snMeal">Meal</label><select id="snMeal">${MEALS.map(x => `<option ${x === m.meal ? "selected" : ""}>${x}</option>`).join("")}</select></div>
      ${m.status === "busy" ? `<p class="small"><span class="spin" aria-hidden="true"></span> Estimating…</p>` : ""}
      ${m.items.length ? `<p class="small"><b class="mono">${tk}</b> kcal, <b class="mono">${Math.round(tp * 10) / 10}</b> g protein</p>` : ""}</div></div>
    ${m.status !== "busy" && hasKey ? `<div class="field"><label class="lbl" for="snNote">Anything the photo can't show? (optional)</label><input id="snNote" type="text" value="${esc(m.note || "")}" placeholder="e.g. 3 eggs fried in butter, large portion"></div>` : ""}
    ${m.error ? `<p class="small" style="color:var(--bad)">${esc(m.error)}</p>` : ""}
    ${m.notes ? `<p class="muted small">${esc(m.notes)}</p>` : ""}
    ${m.items.length ? `<div class="snaphdr small muted"><span>Food</span><span>kcal</span><span>Protein g</span><span></span></div>${rows}` : ""}
    <div class="row">${hasKey && m.status !== "busy" ? `<button class="btn ${m.items.length ? "" : "primary"}" data-act="snapAI">${m.items.length ? "Estimate again" : "Estimate calories"}</button>` : ""}
      <button class="btn sm" data-act="snapAddRow">+ Add item</button></div>
    <div class="row"><button class="btn primary" data-act="snapSave" ${m.status === "busy" ? "disabled" : ""}>${m.items.length ? "Add to " + (ui.foodDate === todayISO() ? "today" : niceDate(ui.foodDate)) : "Save photo"}</button><button class="btn ghost" data-act="snapCancel">Discard</button></div>
  </section>`;
}
/* ---------- render: more ---------- */
function renderMore() {
  const seg = `<div class="seg" role="group">${[["routine", "Routine"], ["history", "History"], ["settings", "Settings"]].map(([v, l]) => `<button data-act="moreSeg" data-v="${v}" aria-pressed="${ui.more === v}">${l}</button>`).join("")}</div>`;
  return seg + (ui.more === "history" ? renderHistory() : ui.more === "settings" ? renderSettings() : renderRoutine());
}
function exEditForm(ex, dayId) {
  const u = ex.unit;
  return `<div class="edit" id="exEdit">
    <div class="field"><label class="lbl" for="eName">Name</label><input id="eName" type="text" value="${esc(ex.name)}"></div>
    <div class="grid2">
      <div class="field"><label class="lbl" for="eUnit">Type</label><select id="eUnit" data-act-change="unit">${Object.entries(UNITS).map(([k, v]) => `<option value="${k}" ${k === u ? "selected" : ""}>${v.label}</option>`).join("")}</select></div>
      <div class="field"><label class="lbl" for="eSets">Sets</label><input id="eSets" type="number" inputmode="numeric" value="${ex.sets}"></div>
      <div class="field ${u === "time" || u === "sled" ? "hidden" : ""}"><label class="lbl" for="eLo">${u === "skill" ? "Min seconds" : "Min reps"}</label><input id="eLo" type="number" inputmode="numeric" value="${ex.lo}"></div>
      <div class="field ${u === "time" || u === "sled" ? "hidden" : ""}"><label class="lbl" for="eHi">${u === "skill" ? "Max seconds" : "Max reps"}</label><input id="eHi" type="number" inputmode="numeric" value="${ex.hi}"></div>
      <div class="field ${["kg", "load", "cm", "sled", "cardio"].includes(u) ? "" : "hidden"}"><label class="lbl" for="eInc">Step up by</label><input id="eInc" type="number" inputmode="decimal" step="0.25" value="${ex.inc ?? ""}"></div>
      <div class="field"><label class="lbl" for="eRest">Rest</label><input id="eRest" type="text" value="${esc(ex.rest || "")}" placeholder="90 s or 2 min"></div>
      <div class="field"><label class="lbl" for="eSS">Superset letter</label><input id="eSS" type="text" maxlength="2" value="${esc(ex.ss || "")}" placeholder="blank = none"></div>
      <div class="field ${["cm", "best", "bw"].includes(u) ? "" : "hidden"}"><label class="lbl" for="eCon">Jump contacts per rep</label><input id="eCon" type="number" inputmode="numeric" value="${ex.contacts ?? ""}" placeholder="0 if not a jump"></div>
      <div class="field ${u === "time" || u === "sled" ? "" : "hidden"}"><label class="lbl" for="eMax">Build up to (runs)</label><input id="eMax" type="number" inputmode="numeric" value="${ex.maxSets ?? ex.sets}"></div>
      <div class="field ${u === "time" ? "" : "hidden"}"><label class="lbl" for="eSpeed">Counts as speed test</label><select id="eSpeed"><option value="">None</option>${SPEED_TESTS.map(t => `<option value="${t.id}" ${ex.speed === t.id ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select></div>
      <div class="field ${u === "kg" ? "" : "hidden"}"><label class="lbl" for="eBw">Start at bodyweight</label><input id="eBw" type="checkbox" ${ex.bwStart ? "checked" : ""}></div>
    </div>
    <div class="field ${u === "skill" ? "" : "hidden"}"><label class="lbl" for="eSkill">Levels, easiest first (one per line)</label><textarea id="eSkill">${esc((ex.skill || []).join("\n"))}</textarea></div>
    <div class="field ${u === "bw" ? "" : "hidden"}"><label class="lbl" for="eNext">How to make it harder</label><input id="eNext" type="text" value="${esc(ex.next || "")}"></div>
    <div class="field"><label class="lbl" for="eCue">Coaching cue</label><textarea id="eCue">${esc(ex.cue || "")}</textarea></div>
    <div class="field"><label class="lbl" for="eIso">Built-in hold (optional)</label><input id="eIso" type="text" value="${esc(ex.iso || "")}" placeholder="e.g. Final rep: hold 5 s at the top"></div>
    <div class="row"><button class="btn primary" data-act="saveEx" data-day="${dayId}" data-id="${ex.id}">Save exercise</button><button class="btn ghost" data-act="cancelEx">Cancel</button>
    ${ui.confirm === "delEx" ? `<span class="confirm">Delete this exercise? Past logs are kept. <button class="btn danger sm" data-act="delEx" data-day="${dayId}" data-id="${ex.id}">Delete</button><button class="btn ghost sm" data-act="noconfirm">Keep</button></span>` : `<button class="btn ghost danger" style="border:0" data-act="ask" data-c="delEx">Delete</button>`}</div>
  </div>`;
}
function renderRoutine() {
  const ds = days();
  const dayCards = ds.map((d, di) => {
    const editingDay = ui.editDay === d.id;
    const head = editingDay ? `<div class="edit">
      <div class="grid2"><div class="field"><label class="lbl" for="dName">Name</label><input id="dName" type="text" value="${esc(d.name)}"></div>
      <div class="field"><label class="lbl" for="dFocus">Focus</label><input id="dFocus" type="text" value="${esc(d.focus || "")}"></div>
      <div class="field"><label class="lbl" for="dKind">Type</label><select id="dKind">${[["upper", "Upper body"], ["lower", "Lower body / plyometrics"], ["sprint", "Sprint session"], ["other", "Other"]].map(([v, l]) => `<option value="${v}" ${d.kind === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      <div class="field"><label class="lbl" for="dPrep">Start with pelvic-tilt prep</label><input id="dPrep" type="checkbox" ${d.prep ? "checked" : ""}></div></div>
      <div class="field"><label class="lbl" for="dNote">Notes</label><textarea id="dNote">${esc(d.note || "")}</textarea></div>
      <div class="row"><button class="btn primary" data-act="saveDay" data-day="${d.id}">Save</button><button class="btn ghost" data-act="cancelDay">Cancel</button>
      ${ds.length > 1 ? (ui.confirm === "delDay" ? `<span class="confirm">Delete ${esc(d.name)}? <button class="btn danger sm" data-act="delDay" data-day="${d.id}">Delete</button><button class="btn ghost sm" data-act="noconfirm">Keep</button></span>` : `<button class="btn ghost" style="color:var(--bad)" data-act="ask" data-c="delDay">Delete workout</button>`) : ""}</div></div>`
      : `<div class="exhead"><h3>${esc(d.name)}${d.focus ? `<span class="focus">${esc(d.focus)}</span>` : ""}</h3><span class="row" style="gap:4px"><button class="btn ghost sm" data-act="mvDay" data-day="${d.id}" data-v="-1" ${di === 0 ? "disabled" : ""} aria-label="Move earlier">↑</button><button class="btn ghost sm" data-act="mvDay" data-day="${d.id}" data-v="1" ${di === ds.length - 1 ? "disabled" : ""} aria-label="Move later">↓</button><button class="btn sm" data-act="editDay" data-day="${d.id}">Edit</button></span></div>${d.prep ? `<p class="muted small">Starts with pelvic-tilt prep</p>` : ""}`;
    const exs = d.ex.map((e, i) => ui.editEx === e.id ? exEditForm({ inc: 0, ...e }, d.id) : `<div class="exrow"><div><div>${esc(e.name)}</div><div class="rx">${UNITS[e.unit]?.label || e.unit} · ${e.unit === "time" || e.unit === "sled" ? e.sets + (e.maxSets > e.sets ? "–" + e.maxSets : "") + " runs" : `${e.sets} × ${e.lo === e.hi ? e.lo : e.lo + "–" + e.hi}${e.unit === "skill" ? " s" : ""}`} · ${esc(e.rest || "")}</div></div>
      <span class="row" style="gap:2px;flex-wrap:nowrap"><button class="btn ghost sm" data-act="mvEx" data-day="${d.id}" data-id="${e.id}" data-v="-1" ${i === 0 ? "disabled" : ""} aria-label="Move up">↑</button><button class="btn ghost sm" data-act="mvEx" data-day="${d.id}" data-id="${e.id}" data-v="1" ${i === d.ex.length - 1 ? "disabled" : ""} aria-label="Move down">↓</button><button class="btn sm" data-act="editEx" data-id="${e.id}">Edit</button></span></div>`).join("");
    return `<section class="card">${head}<div>${exs}</div><div><button class="btn sm" data-act="addEx" data-day="${d.id}">+ Add exercise</button></div></section>`;
  }).join("");
  const W = S.program.warmup;
  const warm = `<section class="card"><h3>Pelvic-tilt prep</h3><p class="muted small">Shown at the start of any workout set to use it.</p>
    <div class="list">${W.map((w, i) => ui.editWarm === w.id ? `<div class="edit"><div class="field"><label class="lbl" for="wName">Name</label><input id="wName" type="text" value="${esc(w.name)}"></div><div class="field"><label class="lbl" for="wDose">Dose</label><input id="wDose" type="text" value="${esc(w.dose)}"></div><div class="field"><label class="lbl" for="wCue">Cue</label><textarea id="wCue">${esc(w.cue)}</textarea></div><div class="row"><button class="btn primary" data-act="saveWarm" data-id="${w.id}">Save</button><button class="btn ghost" data-act="cancelWarm">Cancel</button><button class="btn ghost" style="color:var(--bad)" data-act="delWarm" data-id="${w.id}">Delete</button></div></div>`
      : `<div class="it"><div>${esc(w.name)} <span class="rx">${esc(w.dose)}</span></div><span class="row" style="gap:2px;flex-wrap:nowrap"><button class="btn ghost sm" data-act="mvWarm" data-id="${w.id}" data-v="-1" ${i === 0 ? "disabled" : ""} aria-label="Move up">↑</button><button class="btn sm" data-act="editWarm" data-id="${w.id}">Edit</button></span></div>`).join("")}</div>
    <div><button class="btn sm" data-act="addWarm">+ Add stretch or drill</button></div></section>`;
  return `<p class="muted small">Workouts run in this order and repeat. Edit anything: your logs and progression carry on for exercises you keep.</p>
  ${dayCards}
  <div class="row"><button class="btn" data-act="addDay">+ Add workout</button></div>
  ${warm}
  <section class="card"><h3>How progression works</h3><ol class="rules">
    <li><b>Belt and dumbbell lifts:</b> keep the weight until every set hits the top of the rep range, then add the step and drop back to the bottom.</li>
    <li><b>Skills:</b> hold for the time range at your level. Once every set reaches the top, you move up a level.</li>
    <li><b>Jumps:</b> 3–5 quality reps with full rest. Heights go up only once you own them; distances are tested against your best.</li>
    <li><b>Sprints:</b> full recovery (about 1 min per 10 m sprinted). When you hold your speed across every rep, the app adds a rep, up to the limit. Times you beat are your overload.</li>
    <li><b>Sled:</b> start around 40% of bodyweight and add 5 kg when you finish every run, up to about 80% of bodyweight. Then the app adds runs instead.</li>
    <li><b>Contrast pairs:</b> a heavy strength set, 1–2 min rest, then the matching jumps. Jump quality comes first.</li>
    <li><b>Stalled for three sessions?</b> The Train tab suggests a reset to about 90%.</li>
    <li><b>Deload every 6–8 weeks:</b> half the sets for a week, same loads, fewer jumps and sprints.</li>
    <li><b>Machines and cables:</b> same double progression. Note the seat and pin settings so the numbers mean the same thing every week.</li>
    <li><b>Supersets:</b> exercises with the same letter are done back to back: one set of each, no rest in between, then the full rest. They work different muscles, so neither gets weaker, and a 2025 review of studies found supersets get the same reps and weight done in noticeably less time. To pair your own, give two exercises the same letter in the editor and put them next to each other.</li>
    <li><b>Incline walk:</b> +5 min a session up to 30 on upper days (20 on leg days), then +1% incline up to 15%, then a little more speed.</li></ol>
  <h3 style="margin-top:14px">Getting the most from every set</h3><ul class="rules">
    <li><b>Go close to failure.</b> Muscle growth keeps improving the closer sets end to failure, while strength gains are similar anywhere from about 0–4 reps left. Leave 1–2 in the tank on big lifts and push isolation lifts to 0–1.</li>
    <li><b>Own the stretch.</b> Full range with a slow 2–3 s lowering into the deepest safe stretch. Lengthened-position training tends to match or beat short ranges for growth.</li>
    <li><b>Enough hard sets.</b> About 10–20 hard sets per muscle a week works for most people. Gains keep coming beyond that but with diminishing returns, especially for strength.</li>
    <li><b>Rest long enough.</b> 2–3 min on pull-ups, dips, presses and rows so the next set isn't wasted.</li>
    <li><b>Keep the weights heavy while cutting.</b> Heavy training plus about 1.6–2.2 g protein per kg is what tells your body to keep muscle while you lose fat.</li></ul>
  ${ui.confirm === "resetProg" ? `<div class="confirm">Replace your routine with the original? Your logs are kept. <button class="btn danger sm" data-act="resetProg">Reset routine</button><button class="btn ghost sm" data-act="noconfirm">Cancel</button></div>` : `<div><button class="btn ghost sm" data-act="ask" data-c="resetProg">Reset routine to original</button></div>`}</section>`;
}
function renderHistory() {
  if (!S.sessions.length) return `<div class="empty">No sessions yet. Your first saved workout will appear here with every set.</div>`;
  return S.sessions.map(s => {
    const d = dayById(s.day) || { name: s.meta?.__day || s.day }, ents = Object.entries(s.entries || {}), nsets = ents.reduce((a, [, v]) => a + v.length, 0);
    return `<section class="card"><details><summary><div class="lbl">${niceDate(s.date)}</div><h3>${esc(d.name)} · <span class="muted mono">${nsets} sets</span></h3></summary>
      <div class="tablewrap" style="margin-top:8px"><table class="plan"><tbody>${ents.map(([id, v]) => { const e = exFor(id, s); return `<tr><td>${esc(e.name)}</td><td class="n">${v.map(x => setText(e, x)).join(" · ")}</td></tr>`; }).join("")}</tbody></table></div>
      ${s.warmup != null ? `<p class="muted small" style="margin-top:6px">Pelvic-tilt prep: ${s.warmup}/${S.program.warmup.length} done</p>` : ""}
      ${s.notes ? `<p class="muted" style="margin-top:6px">${esc(s.notes)}</p>` : ""}${s.bw ? `<p class="muted mono small">BW ${fmt(s.bw)} kg</p>` : ""}
      <div style="margin-top:8px">${ui.confirm === "s" + s.id ? `<span class="confirm">Delete this session? <button class="btn danger sm" data-act="delSession" data-id="${s.id}">Delete</button><button class="btn ghost sm" data-act="noconfirm">Keep</button></span>` : `<button class="btn ghost sm" data-act="ask" data-c="s${s.id}">Delete</button>`}</div></details></section>`;
  }).join("");
}
function renderSettings() {
  const counts = `${S.sessions.length} sessions · ${S.speed.length} sprint times · ${S.body.length} body entries · ${Object.keys(S.food.days).length} food days`;
  return `<section class="card"><h3>Back up your data</h3>
    <p class="muted small">Everything is stored on this phone. If you delete the app from your home screen, the data goes with it, so save a backup now and then (to Files, iCloud Drive or email).</p>
    <p class="small mono">${counts}</p>
    <div class="row"><button class="btn primary" data-act="export">Save backup</button><button class="btn" data-act="pickBackup">Restore from backup</button></div>
    <p class="muted small">Backups include your routine, logs, schedule and food, but not photos.</p></section>
  <section class="card"><h3>Calorie estimates from photos</h3>
    <p class="muted small">This uses your own Anthropic API key, so photos go straight from your phone to Anthropic for an estimate. It's pay-as-you-go and billed by Anthropic separately from any Claude subscription, so set a monthly spending limit in the console. Estimates from photos can be well off, especially for oils, sauces and portion sizes, so check them.</p>
    <p class="small">Get a key at <b>console.anthropic.com</b> → API keys. Keep it private: don't share it or post it.</p>
    ${S.settings.aiKey ? `<div class="row" style="align-items:center"><span class="small">Key saved, ending <b class="mono">${esc(S.settings.aiKey.slice(-4))}</b></span><button class="btn ghost sm" data-act="aiKeyRemove">Remove key</button></div>`
      : `<div class="row"><div class="field grow"><label class="lbl" for="aiKey">API key</label><input id="aiKey" type="password" autocomplete="off" placeholder="sk-ant-…"></div><button class="btn" data-act="aiKeySave">Save key</button></div>`}
  </section>
  <section class="card"><h3>Settings</h3>
    <label class="row" style="align-items:center"><input type="checkbox" id="setSound" ${S.settings.sound ? "checked" : ""}> <span>Beep when rest is over</span></label>
    <p class="muted small">iPhones mute the beep when the ring/silent switch is on silent. The screen stays awake while a rest timer is running.</p></section>
  <section class="card"><h3>Install on your iPhone</h3><ol class="rules"><li>Open this page in <b>Safari</b>.</li><li>Tap the <b>Share</b> button.</li><li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li></ol><p class="muted small">It then opens full screen from its own icon and works without signal.</p></section>
  <section class="card"><h3>Start over</h3>${ui.confirm === "wipe" ? `<div class="confirm">Delete every log, schedule and food entry on this phone? <button class="btn danger sm" data-act="wipe">Delete everything</button><button class="btn ghost sm" data-act="noconfirm">Cancel</button></div>` : `<div><button class="btn danger sm" data-act="ask" data-c="wipe">Delete all data</button></div>`}<p class="muted small">Version ${VERSION}</p></section>`;
}

/* ---------- actions ---------- */
function readSnapRows() { if (!ui.snap) return; ui.snap.items = ui.snap.items.map((x, i) => ({ ...x, name: (val(`sn-n-${i}`) ?? x.name).trim() || "Food", kcal: Math.round(parseFloat(val(`sn-k-${i}`) ?? x.kcal) || 0), protein: Math.round((parseFloat(val(`sn-p-${i}`) ?? x.protein) || 0) * 10) / 10 })); const n = val("snNote"); if (n !== undefined) ui.snap.note = n; const ml = val("snMeal"); if (ml) ui.snap.meal = ml; }
async function runSnapAI() {
  const m = ui.snap; if (!m) return; readSnapRows(); m.status = "busy"; m.error = ""; render();
  try { const blob = await idb.get(m.id); const r = await estimateMeal(blob, m.note); if (ui.snap !== m) return; m.items = r.items; m.notes = r.notes; if (!r.items.length) m.error = "No food found in that photo. Add the items yourself."; }
  catch (e) { if (ui.snap !== m) return; m.error = e.code === "auth" ? "Your API key wasn't accepted. Check it in More → Settings." : e.code === "network" ? "Estimates need signal. Add the items yourself, or try again when you're online." : e.code === "parse" ? "The estimate came back in an unexpected format. Try again." : e.code === "nokey" ? "Add an API key in More → Settings to get estimates." : `The estimate failed (error ${e.status || "unknown"}). Try again shortly.`; }
  m.status = ""; render();
}
function readNum(id) { const v = parseFloat(document.getElementById(id)?.value); return Number.isFinite(v) ? v : null; }
const val = id => { const el = document.getElementById(id); return el ? el.value : undefined; };
let bwTimer;
document.addEventListener("input", e => {
  const t = e.target;
  if (t.id === "bw") { const v = parseFloat(t.value); clearTimeout(bwTimer); bwTimer = setTimeout(() => { S.settings.bw = Number.isFinite(v) ? v : null; save(); }, 500); return; }
  if (t.id === "date") { ui.date = t.value || todayISO(); return; }
  if (t.id === "steps") { const v = parseInt(t.value, 10); clearTimeout(bwTimer); bwTimer = setTimeout(() => { if (v > 0) S.steps[todayISO()] = v; else delete S.steps[todayISO()]; save(); }, 500); return; }
  if (t.id === "notes") { const dr = getDraft(ui.day); dr.notes = t.value; putDraft(ui.day, dr); return; }
  if (t.dataset.ex && t.dataset.f) { const dr = getDraft(ui.day), rows = draftRows(dr, t.dataset.ex), i = +t.dataset.i; rows[i] = { ...rows[i], [t.dataset.f]: t.value }; putDraft(ui.day, dr); }
});
document.addEventListener("change", async e => {
  const t = e.target;
  if (t.id === "progEx") { ui.progEx = t.value; render(); }
  else if (t.id === "spTest") { ui.speedTest = t.value; }
  else if (t.id === "icsTarget") { ui.icsTarget = t.value; }
  else if (t.id === "setSound") { S.settings.sound = t.checked; save(); }
  else if (t.id === "eUnit") { // re-render form with new type, keeping typed values
    const d = days().find(x => x.ex.some(y => y.id === ui.editEx)); const ex = d.ex.find(y => y.id === ui.editEx); const draft = readExForm(ex); draft.unit = t.value; if (t.value === "skill" && !draft.skill?.length) draft.skill = ["Level 1", "Level 2", "Level 3"];
    ui.exDraft = draft; const box = document.getElementById("exEdit"); box.outerHTML = exEditForm(draft, d.id); }
  else if (t.id && t.id.startsWith("p") && ["pTarget", "pWhen", "pEarliest", "pLatest", "pUpper", "pLower", "pBuffer", "pBufUni", "pAuto", "pWalk"].includes(t.id)) {
    const P = S.sched.prefs; P.target = +val("pTarget"); P.when = val("pWhen"); P.earliest = val("pEarliest") || "07:00"; P.latest = val("pLatest") || "21:30";
    P.upper = Math.max(20, +val("pUpper") || 80); P.lower = Math.max(20, +val("pLower") || 100); P.autoDur = !!document.getElementById("pAuto")?.checked; P.walkInPlan = !!document.getElementById("pWalk")?.checked; P.buffer = Math.max(0, +val("pBuffer") || 0); P.bufSet = true; P.bufferUni = Math.max(0, +(val("pBufUni") ?? 5) || 0);
    save(); invalidatePlan(); render(); toast("Plan updated");
  }
  else if (t.id === "fileIcs" && t.files[0]) {
    try { const text = await t.files[0].text(); const evs = parseICS(text); if (!evs.length) { toast("No timed events found in that file."); } else { importEvents(evs, ui.icsTarget); toast(`Imported ${evs.length} ${ui.icsTarget} events`); render(); } } catch { toast("Couldn't read that file. Make sure it's a calendar (.ics) file."); }
    t.value = "";
  }
  else if (t.id === "fileBackup" && t.files[0]) {
    try { const v = JSON.parse(await t.files[0].text()); if (!v || !v.program || !Array.isArray(v.sessions)) throw 0; ui.pendingRestore = v; ui.confirm = "restore"; render(); toast("Check the restore below"); }
    catch { toast("That file isn't a Guggz's Planner backup."); }
    t.value = "";
  }
  else if ((t.id === "fileMeal" || t.id === "fileMealLib") && t.files[0]) {
    try { const blob = await compress(t.files[0]); const id = uid("m"); await idb.put(id, blob); ui.snap = { id, meal: mealGuess(), items: [], status: "", note: "" }; render();
      if ((S.settings.aiKey || "").trim()) runSnapAI(); }
    catch { toast("Couldn't read that photo. Try again."); }
    t.value = "";
  }
  else if (t.id === "snMeal" && ui.snap) { ui.snap.meal = t.value; }
  else if (t.id === "filePhoto" && t.files[0]) {
    try { const blob = await compress(t.files[0]); const id = uid("b"); await idb.put(id, blob); S.body.push({ id, date: val("bdDate") || todayISO(), photo: true }); save(); render(); toast("Photo saved"); }
    catch { toast("Couldn't save that photo."); }
    t.value = "";
  }
});
function readExForm(ex) {
  const n = id => { const v = parseFloat(val(id)); return Number.isFinite(v) ? v : null; };
  const o = { ...ex, name: (val("eName") || "").trim() || "Exercise", unit: val("eUnit"), sets: Math.max(1, Math.round(n("eSets") || 3)), lo: Math.max(1, Math.round(n("eLo") || 1)), hi: Math.max(1, Math.round(n("eHi") || 1)), rest: (val("eRest") || "").trim() || "90 s", cue: (val("eCue") || "").trim(), iso: (val("eIso") || "").trim() };
  if (o.hi < o.lo) [o.lo, o.hi] = [o.hi, o.lo];
  o.ss = (val("eSS") || "").trim().toUpperCase().slice(0, 2); if (!o.ss) delete o.ss;
  if (o.unit === "time" || o.unit === "sled") { o.lo = 1; o.hi = 1; o.maxSets = Math.max(o.sets, Math.round(n("eMax") || o.sets)); } else delete o.maxSets;
  if (o.unit === "time") o.speed = val("eSpeed") || undefined; else delete o.speed;
  o.inc = ["kg", "load", "cm", "sled", "cardio"].includes(o.unit) ? (n("eInc") ?? (o.unit === "cm" ? 5 : 2.5)) : 0;
  if (o.unit === "cm") o.start = o.start || 30;
  o.contacts = ["cm", "best", "bw"].includes(o.unit) ? (n("eCon") || 0) : 0; if (!o.contacts) delete o.contacts;
  o.bwStart = o.unit === "kg" && document.getElementById("eBw")?.checked; if (!o.bwStart) delete o.bwStart;
  if (o.unit === "skill") o.skill = (val("eSkill") || "").split("\n").map(s => s.trim()).filter(Boolean); if (o.unit === "skill" && !o.skill.length) o.skill = ["Level 1"]; if (o.unit !== "skill") delete o.skill;
  if (o.unit === "bw") o.next = (val("eNext") || "").trim() || "use a harder version"; else delete o.next;
  if (!o.iso) delete o.iso;
  return o;
}
async function shareOrDownload(name, text, type) {
  const file = new File([text], name, { type });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return true; } } catch (e) { if (e && e.name === "AbortError") return false; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); return true;
}
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-act],[data-tab]"); if (!b) return;
  unlockAudio();
  if (b.dataset.tab && !b.dataset.act) { setTab(b.dataset.tab); return; }
  const a = b.dataset.act, D = b.dataset;
  const findDay = id => days().find(d => d.id === id);
  switch (a) {
    case "tab": setTab(D.tab); return;
    case "ask": ui.confirm = D.c; render(); return;
    case "noconfirm": ui.confirm = null; ui.pendingRestore = null; render(); return;
    case "hideInstall": S.settings.installHide = true; save(); render(); return;
    case "day": ui.day = D.day; ui.picked = true; render(); return;
    case "warm": { const dr = getDraft(ui.day); dr.warm[D.w] = !dr.warm[D.w]; putDraft(ui.day, dr); render(); return; }
    case "rest": { const ex = getEx(D.ex); startTimer(restSecs(ex.rest), ex.name); return; }
    case "tick": {
      const ex = getEx(D.ex), dr = getDraft(ui.day), rows = draftRows(dr, ex.id), i = +D.i;
      const kgV = val(`kg-${ex.id}-${i}`), rpEl = document.getElementById(`rp-${ex.id}-${i}`);
      const done = !rows[i]?.done; rows[i] = { ...rows[i], done }; if (done) ui.justTick = { ex: ex.id, i };
      if (kgV !== undefined) rows[i].kg = kgV;
      if (rpEl) rows[i].reps = rpEl.value || (done ? rpEl.placeholder : "");
      if (done && ex.unit === "best" && !(parseFloat(kgV) > 0)) { rows[i].done = false; putDraft(ui.day, dr); render(); toast("Enter the distance first."); return; }
      putDraft(ui.day, dr); const y = window.scrollY; render(); window.scrollTo(0, y);
      const dEx = dayById(ui.day)?.ex || [], me = dEx.find(e => e.id === ex.id) || ex, grp = me.ss ? dEx.filter(e => e.ss === me.ss) : null, gi = grp ? grp.findIndex(e => e.id === me.id) : -1;
      if (done && grp && gi < grp.length - 1) { const nx = grp[gi + 1]; stopTimer(); toast(`Now: ${nx.name}, set ${i + 1}`); document.querySelector(`[data-act="tick"][data-ex="${nx.id}"][data-i="${i}"]`)?.closest("tr")?.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "center" }); return; }
      if (done && grp) { startTimer(restSecs(me.rest), `Superset ${me.ss} · round ${i + 2 <= rows.length ? i + 2 : "done"}`); const back = document.querySelector(`[data-act="tick"][data-ex="${grp[0].id}"][data-i="${i + 1}"]`); if (back) setTimeout(() => back.closest("tr")?.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "center" }), 400); return; }
      if (done && ex.unit !== "cardio") startTimer(restSecs(ex.rest), `${ex.name} · set ${i + 2 <= rows.length ? i + 2 : "done"}`);
      return;
    }
    case "addset": { const dr = getDraft(ui.day), rows = draftRows(dr, D.ex); const prev = rows[rows.length - 1] || {}; const kgV = val(`kg-${D.ex}-${rows.length - 1}`); rows.push({ kg: prev.kg ?? kgV ?? "" }); putDraft(ui.day, dr); const y = window.scrollY; render(); window.scrollTo(0, y); return; }
    case "rmset": { const dr = getDraft(ui.day), rows = draftRows(dr, D.ex); if (rows.length > 1) rows.pop(); putDraft(ui.day, dr); const y = window.scrollY; render(); window.scrollTo(0, y); return; }
    case "cleardraft": delete S.drafts[ui.day]; save(); render(); toast("Entries cleared"); return;
    case "save": {
      const day = dayById(ui.day), dr = getDraft(ui.day), entries = {}, meta = {};
      day.ex.forEach(ex => {
        const sets = [];
        for (let i = 0; i < 40; i++) {
          const kEl = document.getElementById(`kg-${ex.id}-${i}`), rEl = document.getElementById(`rp-${ex.id}-${i}`);
          if (!kEl && !rEl && !document.querySelector(`[data-act="tick"][data-ex="${ex.id}"][data-i="${i}"]`)) break;
          const k = kEl ? parseFloat(kEl.value) : 0, doneRow = (dr.ex[ex.id] || [])[i]?.done;
          if (ex.unit === "best") { if (k > 0) sets.push({ kg: k, reps: 1 }); }
          else if (ex.unit === "time" || ex.unit === "sled") { if (doneRow || (ex.unit === "time" && k > 0)) sets.push({ kg: k > 0 ? k : 0, reps: 1 }); }
          else { const r = parseInt(rEl?.value, 10); if (r > 0) sets.push({ kg: Number.isFinite(k) ? k : 0, reps: r }); }
        }
        if (sets.length) { entries[ex.id] = sets; meta[ex.id] = { name: ex.name, unit: ex.unit, skill: ex.skill, speed: ex.speed, contacts: ex.contacts }; }
      });
      if (!Object.keys(entries).length) { toast("Log at least one set before saving."); return; }
      const warmN = day.prep ? S.program.warmup.filter(w => dr.warm[w.id]).length : null;
      const prs = [];
      for (const [id, sets] of Object.entries(entries)) {
        const ex = { inc: 0, ...getEx(id) };
        const prev = histFor(id).flatMap(s => s.entries[id]); if (!prev.length) continue;
        const pb = bestOf(ex, prev), now = bestOf(ex, sets); if (pb == null || now == null) continue;
        const better = lowerBetter(ex) ? now < pb - 0.05 : now > pb + 1e-9; if (!better) continue;
        const bestSet = sets.reduce((a, x) => { const v = metric(ex, x, S.settings.bw); if (lowerBetter(ex) && !(v > 0)) return a; return !a || (lowerBetter(ex) ? v < a.v : v > a.v) ? { v, x } : a; }, null);
        prs.push({ name: ex.name, text: ex.unit === "kg" || ex.unit === "load" ? `${setText(ex, bestSet.x)} (est. 1RM ${now.toFixed(1)} kg, up from ${pb.toFixed(1)})` : ex.unit === "skill" ? setText(ex, bestSet.x) : ex.unit === "time" ? `${now.toFixed(2)} s, down from ${pb.toFixed(2)} s` : `${setText(ex, bestSet.x)}, previous best ${fmt(pb)}${metricSfx(ex)}` });
      }
      const contactsN = Object.entries(entries).reduce((a, [id, sets]) => a + contactsOf(getEx(id), sets), 0);
      S.sessions.push({ id: uid("s"), date: ui.date || todayISO(), day: day.id, entries, meta, warmup: warmN, notes: (val("notes") || "").slice(0, 2000), bw: S.settings.bw ?? null, ready: readyScore(dr.ready) !== null ? dr.ready : undefined, deload: isDeloadOn(ui.date || todayISO()) || undefined, createdAt: Date.now() });
      sortSessions(); delete S.drafts[day.id]; save(); invalidatePlan(); stopTimer();
      ui.picked = false; const sd = ui.date || todayISO(); ui.date = todayISO(); render(); window.scrollTo(0, 0);
      const wsS = weekStart(todayISO());
      showFinish({ name: day.name, kind: day.kind, date: sd, sets: Object.values(entries).reduce((a, v) => a + v.length, 0), contacts: contactsN, prs, week: S.sessions.filter(x => x.date >= wsS).length, target: +S.sched.prefs.target || 4, next: dayById(nextDayId())?.name || "" });
      return;
    }
    /* plan */
    case "wk": ui.planWeek = addDays(ui.planWeek, +D.v); render(); return;
    case "pin": { const d = D.d; if (S.sched.pinned[d]) delete S.sched.pinned[d]; else { S.sched.pinned[d] = true; delete S.sched.blocked[d]; } save(); invalidatePlan(); render(); return; }
    case "block": { const d = D.d; if (S.sched.blocked[d]) delete S.sched.blocked[d]; else { S.sched.blocked[d] = true; delete S.sched.pinned[d]; } save(); invalidatePlan(); render(); return; }
    case "addShiftOn": ui.shiftDate = D.d; render(); document.getElementById("shiftCard")?.scrollIntoView({ behavior: "smooth", block: "center" }); return;
    case "addShift": {
      const date = val("shDate"), st = val("shStart"), en = val("shEnd"); if (!date || !st || !en) { toast("Fill in the date, start and end."); return; }
      S.sched.work.push({ id: uid("w"), date, start: st, end: en, title: val("shTitle") }); ui.lastShift = { start: st, end: en }; ui.shiftDate = date;
      save(); invalidatePlan(); render(); toast(`Shift added: ${niceDate(date)} ${st}–${en}`); return;
    }
    case "copyWeek": {
      const ws = ui.planWeek, we = addDays(ws, 6), src = S.sched.work.filter(w => w.date >= ws && w.date <= we);
      if (!src.length) { toast("No shifts this week to copy."); return; }
      const keys = new Set(S.sched.work.map(w => w.date + w.start)); let n = 0;
      src.forEach(w => { const d = addDays(w.date, 7); if (!keys.has(d + w.start)) { S.sched.work.push({ ...w, id: uid("w"), date: d }); n++; } });
      save(); invalidatePlan(); ui.planWeek = addDays(ws, 7); render(); toast(`Copied ${n} shift${n === 1 ? "" : "s"} to next week`); return;
    }
    case "delBusy": { if (D.src === "work") S.sched.work = S.sched.work.filter(w => w.id !== D.id); else S.sched.dated = S.sched.dated.filter(w => w.id !== D.id); save(); invalidatePlan(); render(); return; }
    case "addUni": { const st = val("uStart"), en = val("uEnd"); if (!st || !en || toMin(en) <= toMin(st)) { toast("Check the class start and end times."); return; } S.sched.uni.push({ id: uid("u"), day: +val("uDay"), start: st, end: en, title: (val("uTitle") || "").trim() || "Uni" }); save(); invalidatePlan(); render(); toast("Class added"); return; }
    case "delUni": S.sched.uni = S.sched.uni.filter(c => c.id !== D.id); save(); invalidatePlan(); render(); return;
    case "pickIcs": ui.icsTarget = val("icsTarget") || "uni"; $("#fileIcs").click(); return;
    case "fetchIcs": {
      let url = (val("icsUrl") || "").trim(); if (!url) { toast("Paste a calendar link first."); return; }
      url = url.replace(/^webcals?:\/\//i, "https://"); S.sched.icsUrl = url; save(); ui.icsTarget = val("icsTarget") || "uni";
      try { const evs = await fetchFeed(url); importEvents(evs, ui.icsTarget); S.sched.feeds = S.sched.feeds.filter(f => f.type !== ui.icsTarget).concat([{ url, type: ui.icsTarget, last: Date.now(), ok: true }]); S.sched.icsUrl = ""; save(); render(); toast(`Linked. ${evs.length} events imported, and they'll refresh each time you open the app.`); }
      catch { toast("That site won't let the app read the link directly. Open the link in Safari, save the .ics file, and use Import calendar file instead."); }
      return;
    }
    case "unlink": S.sched.feeds = S.sched.feeds.filter(f => f.type !== D.v); save(); render(); toast("Link removed"); return;
    case "refreshFeeds": refreshFeeds(false); return;
    case "clearIcsYes": S.sched.dated = []; ui.confirm = null; save(); invalidatePlan(); render(); return;
    /* progress */
    case "ready": { const dr = getDraft(ui.day); dr.ready[D.k] = +D.v; putDraft(ui.day, dr); const y = window.scrollY; render(); window.scrollTo(0, y); return; }
    case "deloadStart": S.deload.active = todayISO(); S.deload.last = todayISO(); S.deload.snooze = null; save(); render(); toast("Deload week started"); return;
    case "deloadEnd": S.deload.active = null; save(); render(); toast("Deload ended"); return;
    case "deloadSnooze": S.deload.snooze = addDays(todayISO(), 7); save(); render(); toast("I'll remind you next week"); return;
    case "saveGoal": { const g = parseFloat(val("gW")), dt = val("gD"); if (g > 30) S.settings.goalW = g; if (dt) S.settings.goalDate = dt; save(); render(); toast("Goal saved"); return; }
    case "seg": ui.progSeg = D.v; ui.confirm = null; render(); return;
    case "speedTest": ui.speedTest = D.v; render(); return;
    case "addSpeed": { const t = readNum("spTime"); if (!(t > 0)) { toast("Enter a time in seconds, e.g. 2.35"); return; } S.speed.push({ id: uid("t"), date: val("spDate") || todayISO(), test: val("spTest"), time: t }); ui.speedTest = val("spTest"); save(); render(); toast("Time saved"); return; }
    case "delSpeed": S.speed = S.speed.filter(x => x.id !== D.id); save(); render(); return;
    case "addBody": { const w = readNum("bdW"), wa = readNum("bdWaist"), date = val("bdDate") || todayISO(); if (!w && !wa) { toast("Enter your weight or waist."); return; } S.body.push({ id: uid("b"), date, weight: w, waist: wa }); const latest = S.body.filter(x => x.weight).sort((a, b) => b.date.localeCompare(a.date))[0]; if (latest) S.settings.bw = latest.weight; save(); render(); toast("Saved"); return; }
    case "delBody": S.body = S.body.filter(x => x.id !== D.id); save(); render(); return;
    case "pickPhoto": $("#filePhoto").click(); return;
    case "delPhoto": try { await idb.del(D.id); } catch { } S.body = S.body.filter(x => x.id !== D.id); ui.confirm = null; save(); render(); return;
    /* food */
    case "fd": ui.foodDate = addDays(ui.foodDate, +D.v); render(); return;
    case "addFood": case "quickFood": {
      let item; if (a === "quickFood") item = { ...S.food.recent[+D.i] }; else { const name = (val("fName") || "").trim(); const k = readNum("fK"), p = readNum("fP"); if (!name && !k) { toast("Enter a food or its calories."); return; } item = { name: name || "Food", kcal: Math.round(k || 0), protein: Math.round((p || 0) * 10) / 10 }; }
      (S.food.days[ui.foodDate] = S.food.days[ui.foodDate] || []).push({ ...item, id: uid("f") });
      S.food.recent = [{ name: item.name, kcal: item.kcal, protein: item.protein }].concat(S.food.recent.filter(r => r.name.toLowerCase() !== item.name.toLowerCase())).slice(0, 20);
      save(); render(); toast(`Added ${item.name}`); return;
    }
    case "delFood": { const L = S.food.days[ui.foodDate] || [], gone = L.find(x => x.id === D.id); S.food.days[ui.foodDate] = L.filter(x => x.id !== D.id); if (gone?.photo) { const nx = S.food.days[ui.foodDate].find(x => x.meal === gone.meal && !x.photo); if (nx) nx.photo = gone.photo; else idb.del(gone.photo).catch(() => { }); } } if (!S.food.days[ui.foodDate].length) delete S.food.days[ui.foodDate]; save(); render(); return;
    case "cookWeek": ui.cookWeek = D.v; render(); return;
    case "foodSeg": ui.foodSeg = D.v; lastRevealKey = ""; render(); window.scrollTo(0, 0); return;
    case "mince": S.food.beef = D.v === "beef"; save(); render(); return;
    case "shopTick": S.food.shop = S.food.shop || {}; S.food.shop[D.id] = !S.food.shop[D.id]; save(); { const y = window.scrollY; render(); window.scrollTo(0, y); } return;
    case "shopClear": S.food.shop = {}; save(); render(); toast("Shopping list reset"); return;
    case "logMeal": { const m = MEALPLAN.find(x => x.id === D.id); if (!m) return; (S.food.days[ui.foodDate] = S.food.days[ui.foodDate] || []).push({ name: m.name, kcal: m.kcal, protein: m.protein, meal: m.slot, id: uid("f") }); save(); toast(`Logged ${m.name}`); return; }
    case "saveTargets": S.food.targets = { kcal: readNum("tK"), protein: readNum("tP") }; save(); render(); toast("Targets saved"); return;
    /* more */
    case "moreSeg": ui.more = D.v; ui.confirm = null; ui.editEx = ui.editDay = ui.editWarm = null; render(); return;
    case "editDay": ui.editDay = D.day; ui.editEx = null; ui.confirm = null; render(); return;
    case "cancelDay": ui.editDay = null; ui.confirm = null; render(); return;
    case "saveDay": { const d = findDay(D.day); d.name = (val("dName") || "").trim() || d.name; d.focus = (val("dFocus") || "").trim(); d.kind = val("dKind"); d.prep = document.getElementById("dPrep").checked; d.note = (val("dNote") || "").trim(); ui.editDay = null; save(); invalidatePlan(); render(); toast("Workout saved"); return; }
    case "delDay": S.program.days = days().filter(d => d.id !== D.day); ui.editDay = null; ui.confirm = null; save(); invalidatePlan(); render(); toast("Workout deleted"); return;
    case "mvDay": { const ds = days(), i = ds.findIndex(d => d.id === D.day), j = i + +D.v; if (j < 0 || j >= ds.length) return; [ds[i], ds[j]] = [ds[j], ds[i]]; save(); invalidatePlan(); render(); return; }
    case "addDay": { const id = uid("d"); S.program.days.push({ id, name: "New workout", focus: "", kind: "other", prep: false, note: "", ex: [] }); ui.editDay = id; save(); invalidatePlan(); render(); return; }
    case "editEx": ui.editEx = D.id; ui.editDay = null; ui.confirm = null; render(); document.getElementById("exEdit")?.scrollIntoView({ behavior: "smooth", block: "center" }); return;
    case "cancelEx": { const d = days().find(x => x.ex.some(y => y.id === ui.editEx)); const ex = d?.ex.find(y => y.id === ui.editEx); if (ex && ex._new) d.ex = d.ex.filter(y => y.id !== ex.id); ui.editEx = null; ui.confirm = null; save(); render(); return; }
    case "saveEx": { const d = findDay(D.day), i = d.ex.findIndex(x => x.id === D.id); const o = readExForm(d.ex[i]); delete o._new; delete o.day; d.ex[i] = o; ui.editEx = null; ui.confirm = null; save(); render(); toast("Exercise saved"); return; }
    case "delEx": { const d = findDay(D.day); d.ex = d.ex.filter(x => x.id !== D.id); ui.editEx = null; ui.confirm = null; save(); render(); toast("Exercise deleted"); return; }
    case "mvEx": { const d = findDay(D.day), i = d.ex.findIndex(x => x.id === D.id), j = i + +D.v; if (j < 0 || j >= d.ex.length) return; [d.ex[i], d.ex[j]] = [d.ex[j], d.ex[i]]; save(); render(); return; }
    case "addEx": { const d = findDay(D.day), id = uid("x"); d.ex.push({ id, name: "New exercise", unit: "kg", sets: 3, lo: 6, hi: 10, inc: 2.5, rest: "2 min", cue: "", _new: true }); ui.editEx = id; save(); render(); document.getElementById("exEdit")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    case "resetProg": S.program = { warmup: clone(DEFAULT_WARMUP), days: clone(DEFAULT_DAYS) }; ui.confirm = null; save(); invalidatePlan(); render(); toast("Routine reset"); return;
    case "editWarm": ui.editWarm = D.id; render(); return;
    case "cancelWarm": { const w = S.program.warmup.find(x => x.id === ui.editWarm); if (w && w._new) S.program.warmup = S.program.warmup.filter(x => x !== w); ui.editWarm = null; save(); render(); return; }
    case "saveWarm": { const w = S.program.warmup.find(x => x.id === D.id); w.name = (val("wName") || "").trim() || w.name; w.dose = (val("wDose") || "").trim(); w.cue = (val("wCue") || "").trim(); delete w._new; ui.editWarm = null; save(); render(); return; }
    case "delWarm": S.program.warmup = S.program.warmup.filter(x => x.id !== D.id); ui.editWarm = null; save(); render(); return;
    case "mvWarm": { const W = S.program.warmup, i = W.findIndex(x => x.id === D.id); if (i > 0) { [W[i - 1], W[i]] = [W[i], W[i - 1]]; save(); render(); } return; }
    case "addWarm": { const id = uid("w"); S.program.warmup.push({ id, name: "New stretch", dose: "2 × 30 s", cue: "", _new: true }); ui.editWarm = id; save(); render(); return; }
    case "delSession": S.sessions = S.sessions.filter(s => s.id !== D.id); ui.confirm = null; save(); invalidatePlan(); render(); toast("Session deleted"); return;
    case "export": { const data = { ...S, settings: { ...S.settings, aiKey: "" }, drafts: {}, exportedAt: new Date().toISOString(), app: "bar-belt-log", version: VERSION }; const ok = await shareOrDownload(`guggz-backup-${todayISO()}.json`, JSON.stringify(data), "application/json"); if (ok) { S.settings.lastBackup = todayISO(); save(); render(); toast("Backup ready"); } return; }
    case "pickBackup": $("#fileBackup").click(); return;
    case "restoreYes": if (ui.pendingRestore) { const keep = S.settings.aiKey; S = fill(blank(), ui.pendingRestore); S.settings.aiKey = S.settings.aiKey || keep; sortSessions(); save(); invalidatePlan(); ui.pendingRestore = null; ui.confirm = null; render(); toast("Backup restored"); } return;
    case "wipe": localStorage.removeItem(KEY); S = blank(); save(); invalidatePlan(); ui.confirm = null; render(); toast("All data deleted"); return;
    case "tAdj": if (timer) { timer.end += +D.v * 1000; if (timer.end > Date.now()) { timer.fired = false; $("#timer").classList.remove("done"); } tick(); } return;
    case "tStop": stopTimer(); return;
    case "snapCam": $("#fileMeal").click(); return;
    case "snapLib": $("#fileMealLib").click(); return;
    case "snapAI": runSnapAI(); return;
    case "snapAddRow": readSnapRows(); ui.snap.items.push({ name: "", kcal: 0, protein: 0 }); render(); document.getElementById(`sn-n-${ui.snap.items.length - 1}`)?.focus(); return;
    case "snapDel": readSnapRows(); ui.snap.items.splice(+D.i, 1); render(); return;
    case "snapCancel": if (ui.snap) { try { await idb.del(ui.snap.id); } catch { } } ui.snap = null; render(); return;
    case "snapSave": {
      readSnapRows(); const m = ui.snap; const list = (S.food.days[ui.foodDate] = S.food.days[ui.foodDate] || []);
      const items = m.items.filter(x => x.name || x.kcal); 
      if (!items.length) list.push({ id: uid("f"), name: m.meal + " (photo)", kcal: 0, protein: 0, meal: m.meal, photo: m.id });
      else items.forEach((x, i) => { list.push({ id: uid("f"), name: x.name, kcal: x.kcal, protein: x.protein, meal: m.meal, photo: i === 0 ? m.id : undefined }); S.food.recent = [{ name: x.name, kcal: x.kcal, protein: x.protein }].concat(S.food.recent.filter(r => r.name.toLowerCase() !== x.name.toLowerCase())).slice(0, 20); });
      ui.snap = null; save(); render(); toast(items.length ? `Added ${m.meal.toLowerCase()}: ${items.reduce((a, x) => a + x.kcal, 0)} kcal` : "Photo saved"); return;
    }
    case "aiKeySave": { const k = (val("aiKey") || "").trim(); if (!/^sk-ant-/.test(k)) { toast("That doesn't look like an Anthropic key. It starts with sk-ant-."); return; } S.settings.aiKey = k; save(); render(); toast("Key saved on this phone"); return; }
    case "aiKeyRemove": S.settings.aiKey = ""; save(); render(); toast("Key removed"); return;
    case "closeFinish": document.getElementById("finish")?.remove(); return;
  }
});
/* restore confirm lives in settings view */
const _renderSettings = renderSettings;
renderSettings = function () { const base = _renderSettings(); if (ui.confirm !== "restore" || !ui.pendingRestore) return base; const v = ui.pendingRestore; return `<section class="card accent"><h3>Restore this backup?</h3><p class="small">${(v.sessions || []).length} sessions${v.exportedAt ? ` · saved ${niceDate(v.exportedAt.slice(0, 10))}` : ""}. This replaces everything currently on this phone.</p><div class="row"><button class="btn primary" data-act="restoreYes">Restore</button><button class="btn ghost" data-act="noconfirm">Cancel</button></div></section>` + base; };

/* ---------- boot ---------- */
sortSessions();
render();
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => { });
try { navigator.storage?.persist?.(); } catch { }
if (S.sched.feeds.length) refreshFeeds(true);
/* one-time import of the bundled BCU timetable (Mon/Tue, 2026–27) */
const TT_BUNDLE = "bcu-2026-27-v1";
if (S.sched.ttBundled !== TT_BUNDLE) fetch("bcu-timetable.ics", { cache: "no-store" }).then(r => r.ok ? r.text() : Promise.reject()).then(t => {
  if (!/BEGIN:VCALENDAR/.test(t)) return; importEvents(parseICS(t), "uni"); S.sched.ttBundled = TT_BUNDLE; save(); render(); toast("Your BCU timetable has been added to the planner");
}).catch(() => { });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && S.sched.feeds.some(f => Date.now() - (f.last || 0) > 3 * 3600e3)) refreshFeeds(true); });
setInterval(() => { if (ui.tab === "plan" || ui.tab === "train") { invalidatePlan(); } }, 10 * 60 * 1000);
