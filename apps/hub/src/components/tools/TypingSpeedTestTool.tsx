import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

const WORD_BANK = [
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it', 'for', 'not', 'on', 'with', 'he',
  'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or',
  'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about',
  'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know',
  'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then',
  'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how',
  'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day',
  'most', 'us', 'find', 'here', 'thing', 'many', 'those', 'tell', 'very', 'through', 'form', 'sentence',
  'great', 'where', 'help', 'much', 'before', 'line', 'right', 'too', 'mean', 'old', 'same', 'boy',
  'follow', 'came', 'show', 'around', 'farm', 'three', 'small', 'set', 'put', 'end', 'does', 'another',
  'large', 'must', 'big', 'such', 'turn', 'why', 'ask', 'went', 'read', 'need', 'land', 'different',
  'home', 'move', 'try', 'kind', 'hand', 'picture', 'again', 'change', 'off', 'play', 'spell', 'air',
  'away', 'animal', 'house', 'point', 'page', 'letter', 'mother', 'answer', 'found', 'study', 'still',
  'learn', 'should', 'world', 'high', 'every', 'near', 'add', 'food', 'between', 'own', 'below', 'country',
  'plant', 'last', 'school', 'father', 'keep', 'tree', 'never', 'start', 'city', 'earth', 'eye', 'light',
  'thought', 'head', 'under', 'story', 'saw', 'left', 'few', 'while', 'along', 'might', 'close', 'something',
  'seem', 'next', 'hard', 'open', 'example', 'begin', 'life', 'always', 'both', 'paper', 'together', 'got',
  'group', 'often', 'run', 'important', 'until', 'children', 'side', 'feet', 'car', 'mile', 'night', 'walk',
  'white', 'sea', 'began', 'grow', 'took', 'river', 'four', 'carry', 'state', 'once', 'book', 'hear',
  'stop', 'without', 'second', 'later', 'miss', 'idea', 'enough', 'eat', 'face', 'watch', 'far', 'really',
  'almost', 'let', 'above', 'girl', 'sometimes', 'mountain', 'cut', 'young', 'talk', 'soon', 'list', 'song',
  'leave', 'family', 'body', 'music', 'color', 'stand', 'sun', 'questions', 'fish', 'area', 'mark', 'dog',
  'horse', 'birds', 'problem', 'complete', 'room', 'knew', 'since', 'ever', 'piece', 'told', 'usually',
  'friends', 'easy', 'heard', 'order', 'red', 'door', 'sure', 'become', 'top', 'ship', 'across', 'today',
  'during', 'short', 'better', 'best', 'however', 'low', 'hours', 'black', 'products', 'happened', 'whole',
  'measure', 'remember', 'early', 'waves', 'reached', 'listen', 'wind', 'rock', 'space', 'covered', 'fast',
  'several', 'hold', 'himself', 'toward', 'five', 'step', 'morning', 'passed', 'vowel', 'true', 'hundred',
  'against', 'pattern', 'numeral', 'table', 'north', 'slowly', 'money', 'map', 'pulled', 'draw', 'voice',
  'seen', 'cold', 'cried', 'plan', 'notice', 'south', 'sing', 'war', 'ground', 'fall', 'king', 'town',
  'unit', 'figure', 'certain', 'field', 'travel', 'build', 'language', 'among', 'power', 'fine', 'fly',
  'lead', 'cry', 'dark', 'machine', 'note', 'wait', 'star', 'box', 'noun', 'rest', 'correct', 'able',
  'pound', 'done', 'beauty', 'drive', 'stood', 'contain', 'front', 'teach', 'week', 'final', 'gave',
  'green', 'quick', 'develop', 'ocean', 'warm', 'free', 'minute', 'strong', 'special', 'mind', 'behind',
  'clear', 'tail', 'produce', 'fact', 'street', 'inch', 'multiply', 'nothing', 'course', 'stay', 'wheel',
  'full', 'force', 'blue', 'object', 'decide', 'surface', 'deep', 'moon', 'island', 'foot', 'system',
  'busy', 'test', 'record', 'boat', 'common', 'gold', 'possible', 'plane', 'dry', 'wonder', 'laugh',
  'check', 'game', 'shape', 'hot', 'brought', 'heat', 'snow', 'tire', 'bring', 'yes', 'distant', 'fill',
  'east', 'paint', 'grand', 'ball', 'yet', 'wave', 'drop', 'heart', 'present', 'heavy', 'dance', 'engine',
  'position', 'arm', 'wide', 'sail', 'material', 'size', 'vary', 'settle', 'speak', 'weight', 'general',
  'matter', 'circle', 'pair', 'include', 'divide', 'felt', 'perhaps', 'pick', 'sudden', 'count', 'square',
  'reason', 'length', 'represent', 'art', 'subject', 'region', 'energy', 'hunt', 'probable', 'bed',
  'brother', 'egg', 'ride', 'cell', 'believe', 'fraction', 'forest', 'sit', 'race', 'window', 'store',
  'summer', 'train', 'sleep', 'prove', 'leg', 'exercise', 'wall', 'catch', 'mount', 'wish', 'sky', 'board',
  'joy', 'winter', 'written', 'wild', 'instrument', 'kept', 'glass', 'grass', 'job', 'edge', 'sign',
  'visit', 'past', 'soft', 'fun', 'bright', 'gas', 'weather', 'month', 'million', 'bear', 'finish',
  'happy', 'hope', 'flower', 'strange', 'gone', 'jump', 'baby', 'eight', 'village', 'meet', 'root', 'buy',
  'raise', 'solve', 'metal', 'whether', 'push', 'seven', 'paragraph', 'third', 'shall', 'held', 'hair',
  'describe', 'cook', 'floor', 'either', 'result', 'burn', 'hill', 'safe', 'cat', 'century', 'consider',
  'type', 'law', 'bit', 'coast', 'copy', 'phrase', 'silent', 'tall', 'sand', 'soil', 'roll', 'temperature',
  'finger', 'industry', 'value', 'fight', 'lie', 'beat', 'excite', 'natural', 'view', 'sense', 'ear', 'else',
  'quite', 'broke', 'case', 'middle', 'kill', 'son', 'lake', 'moment', 'scale', 'loud', 'spring', 'observe',
  'child', 'straight', 'consonant', 'nation', 'dictionary', 'milk', 'speed', 'method', 'organ', 'pay', 'age',
  'section', 'dress', 'cloud', 'surprise', 'quiet', 'stone', 'tiny', 'climb', 'cool', 'design', 'poor', 'lot',
  'experiment', 'bottom', 'key', 'iron', 'single', 'stick', 'flat', 'twenty', 'skin', 'smile', 'crease',
  'hole', 'trade', 'melody', 'trip', 'office', 'receive', 'row', 'mouth', 'exact', 'symbol', 'die', 'least',
  'trouble', 'shout', 'except', 'wrote', 'seed', 'tone', 'join', 'suggest', 'clean', 'break', 'lady', 'yard',
  'rise', 'bad', 'blow', 'oil', 'blood', 'touch', 'grew', 'cent', 'mix', 'team', 'wire', 'cost', 'lost',
  'brown', 'wear', 'garden', 'equal', 'sent', 'choose', 'fell', 'fit', 'flow', 'fair', 'bank', 'collect',
  'save', 'control', 'decimal', 'gentle', 'woman', 'captain', 'practice', 'separate', 'difficult', 'doctor',
  'please', 'protect', 'noon', 'whose', 'locate', 'ring', 'character', 'insect', 'caught', 'period',
  'indicate', 'radio', 'spoke', 'atom', 'human', 'history', 'effect', 'electric', 'expect', 'crop', 'modern',
  'element', 'hit', 'student', 'corner', 'party', 'supply', 'bone', 'rail', 'imagine', 'provide', 'agree',
  'thus', 'capital', 'chair', 'danger', 'fruit', 'rich', 'thick', 'soldier', 'process', 'operate', 'guess',
  'necessary', 'sharp', 'wing', 'create', 'neighbor', 'wash', 'bat', 'rather', 'crowd', 'corn', 'compare',
  'poem', 'string', 'bell', 'depend', 'meat', 'rub', 'tube', 'famous', 'dollar', 'stream', 'fear', 'sight',
  'thin', 'triangle', 'planet', 'hurry', 'chief', 'colony', 'clock', 'mine', 'tie', 'enter', 'major', 'fresh',
  'search', 'send', 'yellow', 'gun', 'allow', 'print', 'dead', 'spot', 'desert', 'suit', 'current', 'lift',
  'rose', 'continue', 'block', 'chart', 'hat', 'sell', 'success', 'company', 'subtract', 'event', 'particular',
  'deal', 'swim', 'term', 'opposite', 'wife', 'shoe', 'shoulder', 'spread', 'arrange', 'camp', 'invent',
  'cotton', 'born', 'determine', 'quart', 'nine', 'truck', 'noise', 'level', 'chance', 'gather', 'shop',
  'stretch', 'throw', 'shine', 'property', 'column', 'molecule', 'select', 'wrong', 'gray', 'repeat',
  'require', 'broad', 'prepare', 'salt', 'nose', 'plural', 'anger', 'claim', 'continent', 'oxygen', 'sugar',
  'death', 'pretty', 'skill', 'women', 'season', 'solution', 'magnet', 'silver', 'thank', 'branch', 'match',
  'suffix', 'especially', 'fig', 'afraid', 'huge', 'sister', 'steel', 'discuss', 'forward', 'similar',
  'guide', 'experience', 'score', 'apple', 'bought', 'led', 'pitch', 'coat', 'mass', 'card', 'band', 'rope',
  'slip', 'win', 'dream', 'evening', 'condition', 'feed', 'tool', 'total', 'basic', 'smell', 'valley', 'nor',
  'double', 'seat', 'arrive', 'master', 'track', 'parent', 'shore', 'division', 'sheet', 'substance', 'favor',
  'connect', 'post', 'spend', 'chord', 'fat', 'glad', 'original', 'share', 'station', 'dad', 'bread', 'charge',
  'proper', 'bar', 'offer', 'segment', 'duck', 'instant', 'market', 'degree', 'populate', 'chick', 'dear',
  'enemy', 'reply', 'drink', 'occur', 'support', 'speech', 'nature', 'range', 'steam', 'motion', 'path',
  'liquid', 'log', 'meant', 'quotient', 'teeth', 'shell', 'neck',
];

const TEST_SECONDS = 60;
const WORD_COUNT = 50;
const STORAGE_KEY = 'gsm-tools:typing-speed-best';

type CharState = 'pending' | 'correct' | 'incorrect' | 'extra';

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickWords(): string[] {
  return shuffle(WORD_BANK).slice(0, WORD_COUNT);
}

function charState(target: string, typed: string, index: number): CharState {
  if (index >= typed.length) return 'pending';
  if (index >= target.length) return 'extra';
  return typed[index] === target[index] ? 'correct' : 'incorrect';
}

function charClass(state: CharState): string {
  switch (state) {
    case 'correct':
      return 'text-white';
    case 'incorrect':
      return 'text-rose-400';
    case 'extra':
      return 'text-rose-900 bg-rose-950/80';
    default:
      return 'text-slate-500';
  }
}

function computeStats(target: string, typed: string, finished: boolean, startedAt: number | null) {
  let correctChars = 0;
  for (let i = 0; i < typed.length; i++) {
    if (i < target.length && typed[i] === target[i]) correctChars++;
  }
  const errors = typed.length - correctChars;
  const accuracy = typed.length === 0 ? 100 : Math.round((correctChars / typed.length) * 100);
  const elapsed = startedAt ? Math.min((Date.now() - startedAt) / 1000, TEST_SECONDS) : 0;
  const wpm = finished
    ? Math.round(correctChars / 5)
    : elapsed > 0
      ? Math.round(correctChars / 5 / (elapsed / 60))
      : 0;
  return { correctChars, errors, accuracy, wpm };
}

export default function TypingSpeedTestTool() {
  const [words, setWords] = useState<string[]>(() => pickWords());
  const [typed, setTyped] = useState('');
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(TEST_SECONDS);
  const [tick, setTick] = useState(0);
  const [status, setStatus] = useState('Click the words and start typing — timer begins on your first keystroke.');
  const inputRef = useRef<HTMLInputElement>(null);
  const typedRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const targetText = useMemo(() => words.join(' '), [words]);
  const caretIndex = typed.length;

  const stats = useMemo(
    () => computeStats(targetText, typed, finished, startedAtRef.current),
    [targetText, typed, finished, tick]
  );

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const finishTest = useCallback(() => {
    stopTimer();
    setRunning(false);
    setFinished(true);
    setSecondsLeft(0);

    const currentTyped = typedRef.current;
    const { wpm, accuracy } = computeStats(targetText, currentTyped, true, startedAtRef.current);
    setStatus(`Time's up! Final: ${wpm} WPM at ${accuracy}% accuracy.`);

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const best = raw ? (JSON.parse(raw) as { wpm: number }).wpm : 0;
      if (wpm > best) {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ wpm, accuracy, date: new Date().toISOString() })
        );
        setStatus((s) => `${s} New personal best!`);
      } else if (best > 0) {
        setStatus((s) => `${s} Personal best: ${best} WPM.`);
      }
    } catch {
      /* ignore */
    }
  }, [stopTimer, targetText]);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    startedAtRef.current = Date.now();
    setRunning(true);
    setStatus('Keep typing — the clock is running.');
    timerRef.current = setInterval(() => {
      setTick((t) => t + 1);
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          finishTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [finishTest]);

  const reset = useCallback(() => {
    stopTimer();
    setWords(pickWords());
    setTyped('');
    typedRef.current = '';
    setRunning(false);
    setFinished(false);
    setSecondsLeft(TEST_SECONDS);
    startedAtRef.current = null;
    setStatus('Click the words and start typing — timer begins on your first keystroke.');
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [stopTimer]);

  useEffect(() => () => stopTimer(), [stopTimer]);

  const focusInput = () => {
    if (!finished) inputRef.current?.focus();
  };

  const handleChange = (value: string) => {
    if (finished) return;
    if (!running && value.length > 0) startTimer();
    typedRef.current = value;
    setTyped(value);
  };

  const renderCharacters = () => {
    const nodes: ReactNode[] = [];

    for (let i = 0; i < targetText.length; i++) {
      if (i === caretIndex && !finished) {
        nodes.push(
          <span key={`caret-${i}`} className="caret-blink mx-px inline-block w-0.5 text-emerald-400" aria-hidden="true">
            |
          </span>
        );
      }
      const ch = targetText[i];
      nodes.push(
        <span key={`char-${i}`} className={`character ${charClass(charState(targetText, typed, i))}`}>
          {ch === ' ' ? '\u00a0' : ch}
        </span>
      );
    }

    if (caretIndex >= targetText.length && !finished) {
      nodes.push(
        <span key="caret-end" className="caret-blink mx-px inline-block w-0.5 text-emerald-400" aria-hidden="true">
          |
        </span>
      );
    }

    if (typed.length > targetText.length) {
      for (let i = targetText.length; i < typed.length; i++) {
        nodes.push(
          <span key={`extra-${i}`} className="character text-rose-900 bg-rose-950/80">
            {typed[i]}
          </span>
        );
      }
    }

    return nodes;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl sm:p-6 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-sm tabular-nums">
            <span className="font-semibold text-emerald-400">{stats.wpm} WPM</span>
            <span className="text-slate-400">{stats.accuracy}% acc</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-emerald-800/50 bg-emerald-950/40 px-3 py-1.5 text-lg font-bold tabular-nums text-emerald-400">
              {secondsLeft}s
            </span>
            <button type="button" onClick={reset} className="btn-secondary px-3 py-1.5 text-xs">
              Restart
            </button>
          </div>
        </div>

        <div
          className="relative mt-5 min-h-[140px] cursor-text rounded-xl border border-slate-800 bg-slate-950/80 p-5 font-mono text-lg leading-relaxed tracking-wide"
          onClick={focusInput}
          role="textbox"
          tabIndex={-1}
          aria-label="Typing test area"
        >
          <div className="flex flex-wrap">{renderCharacters()}</div>
          <input
            ref={inputRef}
            type="text"
            value={typed}
            onChange={(e) => handleChange(e.target.value)}
            disabled={finished}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            aria-label="Hidden typing input"
            className="absolute inset-0 h-full w-full cursor-text opacity-0"
          />
        </div>

        <p className="mt-3 text-center text-xs text-slate-500">{status}</p>

        <style>{`
          .caret-blink {
            animation: caret-blink 1s step-start infinite;
          }
          @keyframes caret-blink {
            50% { opacity: 0; }
          }
        `}</style>
      </section>

      <section className="rounded-2xl border border-emerald-900/40 bg-gradient-to-br from-emerald-950/50 to-slate-900/60 p-5 shadow-xl sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-400/80">Live stats</h2>
        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-emerald-800/40 bg-slate-950/50 px-4 py-5 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">WPM</p>
            <p className="mt-1 text-4xl font-extrabold tabular-nums text-emerald-400">{stats.wpm}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-4 text-center">
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Accuracy</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-white">{stats.accuracy}%</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-4 text-center">
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Correct</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-400">{stats.correctChars}</p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-4 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Errors</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-rose-400">{stats.errors}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
