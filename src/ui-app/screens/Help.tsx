import { useNavigate } from 'react-router-dom';

function Help() {
  const navigate = useNavigate();

  return (
    <div className="screen" style={{ paddingBottom: '32px' }}>
      <div className="flex-row items-center gap-md" style={{ marginBottom: '24px' }}>
        <button className="btn-icon" onClick={() => navigate(-1)} aria-label="Back">
          <BackIcon />
        </button>
        <h2 style={{ margin: 0 }}>How to Play</h2>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {/* The Basics */}
        <Section title="The Basics">
          <p>
            <strong>Listen. Identify. Tap.</strong>
          </p>
          <p>
            Bird sounds play through your left or right ear. Identify which bird is singing
            and tap its circle on the correct side before the tile passes the scoring zone.
          </p>
          <p>
            Each round is 30 seconds. Use headphones for the best experience!
          </p>
        </Section>

        {/* Scoring */}
        <Section title="Scoring">
          <ScoreRow label="Perfect" points={100} description="Right bird + right ear + great timing" color="var(--color-success)" />
          <ScoreRow label="Good" points={75} description="Right bird + right ear" color="var(--color-success)" />
          <ScoreRow label="Partial" points={25} description="Right bird, wrong ear" color="var(--color-accent)" />
          <ScoreRow label="Miss" points={0} description="Wrong bird or no response" color="var(--color-error)" />
        </Section>

        {/* The Packs */}
        <Section title="The Packs">
          <PackInfo
            name="5 Common Backyard Birds"
            description="Perfect for beginners. Five distinctive birds you'll hear in your own backyard: Cardinal, Carolina Wren, Titmouse, Blue Jay, and Crow."
          />
          <PackInfo
            name="Expanded Local Birds"
            description="27 species from the eastern US. Each round picks 9 random birds, so every game is different!"
          />
          <PackInfo
            name="Sparrows"
            description="Master the subtle singers! Seven sparrow species with distinctive patterns: White-throated, Song, Chipping, Swamp, Savannah, Field, and Lincoln's."
          />
          <PackInfo
            name="Woodpeckers"
            description="Drums, rattles, and calls. Learn seven species: Downy, Hairy, Red-bellied, Pileated, Yellow-bellied Sapsucker, Northern Flicker, and Red-headed."
          />
        </Section>

        {/* The Levels */}
        <Section title="The Levels">
          <p style={{ marginBottom: '12px', color: 'var(--color-text-muted)', fontSize: '14px' }}>
            Each pack has 6 levels that build your skills:
          </p>
          <LevelInfo level={1} title="Meet the Birds" description="One clear recording per bird, single ear. Learn each signature voice." />
          <LevelInfo level={2} title="Sound Variations" description="Up to 3 recordings per bird. Same species, different songs." />
          <LevelInfo level={3} title="Full Repertoire" description="All recordings in play. Master every variation." />
          <LevelInfo level={4} title="Both Ears" description="Sounds from either side. Identify the bird AND the direction." />
          <LevelInfo level={5} title="Variations + Both Ears" description="Multiple recordings, either ear. Getting challenging!" />
          <LevelInfo level={6} title="Master Birder" description="Everything at once. You're a pro now." />
        </Section>

        {/* Tips */}
        <Section title="Tips">
          <Tip>Use headphones. The left/right distinction matters!</Tip>
          <Tip>Start with the Starter Pack, even if you're eager for more.</Tip>
          <Tip>Use Bird Reference on the Pack Select screen to preview sounds.</Tip>
          <Tip>Don't rush. Let the sound register before you tap.</Tip>
          <Tip>Check the round summary to see which birds need practice.</Tip>
          <Tip>Once you've mastered the sounds, try playing muted - identify birds by their spectrograms alone!</Tip>
          <Tip>Adjust tile speed in Settings if things move too fast (or too slow).</Tip>
        </Section>

        {/* Bird Codes */}
        <Section title="The 4-Letter Codes">
          <p>
            Birders use standardized 4-letter codes (called "Alpha codes") as shorthand for species names.
            They're easy to learn:
          </p>
          <div style={{
            background: 'var(--color-surface)',
            padding: '12px',
            borderRadius: '8px',
            marginTop: '8px',
            fontSize: '14px',
            lineHeight: 1.6
          }}>
            <div><strong>Two-word names:</strong> First 2 letters of each word</div>
            <div style={{ color: 'var(--color-text-muted)', marginLeft: '12px' }}>
              Northern Cardinal → NO + CA → NOCA
            </div>
            <div style={{ marginTop: '8px' }}><strong>Three-word names:</strong> 1 + 1 + 2 letters</div>
            <div style={{ color: 'var(--color-text-muted)', marginLeft: '12px' }}>
              Red-bellied Woodpecker → R + B + WO → RBWO
            </div>
          </div>
        </Section>

        {/* Spectrograms */}
        <Section title="The Spectrograms">
          <p>
            The colorful images on tiles are spectrograms - visual pictures of sound.
            Time flows left to right, pitch goes bottom to top, and brightness shows volume.
          </p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
            With practice, you'll recognize birds by their visual patterns too!
          </p>
        </Section>

        {/* Credits */}
        <Section title="Sound Credits">
          <p style={{ fontSize: '14px' }}>
            All recordings from <a href="https://xeno-canto.org" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)' }}>xeno-canto.org</a>,
            a community library of bird sounds from around the world.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <h3 style={{
        fontSize: '16px',
        fontWeight: 600,
        marginBottom: '12px',
        color: 'var(--color-accent)',
        borderBottom: '1px solid var(--color-surface)',
        paddingBottom: '8px',
      }}>
        {title}
      </h3>
      <div style={{ fontSize: '15px', lineHeight: 1.6, color: 'var(--color-text)' }}>
        {children}
      </div>
    </div>
  );
}

function ScoreRow({ label, points, description, color }: { label: string; points: number; description: string; color: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '8px',
      padding: '8px 12px',
      background: 'var(--color-surface)',
      borderRadius: '8px',
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontWeight: 700,
        color,
        minWidth: '40px',
      }}>
        +{points}
      </span>
      <div>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ color: 'var(--color-text-muted)', marginLeft: '8px', fontSize: '13px' }}>
          {description}
        </span>
      </div>
    </div>
  );
}

function PackInfo({ name, description }: { name: string; description: string }) {
  return (
    <div style={{
      marginBottom: '12px',
      padding: '12px',
      background: 'var(--color-surface)',
      borderRadius: '8px',
    }}>
      <div style={{ fontWeight: 600, marginBottom: '4px' }}>{name}</div>
      <div style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>{description}</div>
    </div>
  );
}

function LevelInfo({ level, title, description }: { level: number; title: string; description: string }) {
  return (
    <div style={{
      display: 'flex',
      gap: '12px',
      marginBottom: '8px',
      padding: '8px 12px',
      background: 'var(--color-surface)',
      borderRadius: '8px',
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontWeight: 700,
        color: 'var(--color-accent)',
        minWidth: '24px',
      }}>
        {level}
      </span>
      <div>
        <span style={{ fontWeight: 600 }}>{title}</span>
        <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{description}</div>
      </div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '8px',
      marginBottom: '8px',
      fontSize: '14px',
    }}>
      <span style={{ color: 'var(--color-accent)' }}>•</span>
      <span>{children}</span>
    </div>
  );
}

function BackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export default Help;
