import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { trackExternalLinkClick } from '../utils/analytics';

function Help() {
  const navigate = useNavigate();
  const location = useLocation();

  // Track which sections are expanded (some start open by default)
  // If navigated with #training-mode hash, auto-open Training Mode
  const initialSections = ['Why Learn Bird Song?', 'ChipNotes Basics'];
  if (location.hash === '#training-mode') {
    initialSections.push('Training Mode');
  }
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(initialSections)
  );

  // Track if user has scrolled
  const [hasScrolled, setHasScrolled] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const versionHistoryRef = useRef<HTMLDivElement>(null);
  const hasScrolledToHashRef = useRef(false);


  const allSections = [
    'Why Learn Bird Song?',
    'ChipNotes Basics',
    'The Spectrograms',
    'Scoring',
    'The Bird Packs',
    'The Levels',
    'Tips',
    'Training Mode',
    'Taxonomic Sorting',
    'The 4-Letter Codes',
    'About & Credits',
    'Support This Project',
    'Feedback & Bug Reports',
    'Full Version History'
  ];

  const toggleSection = (title: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(title)) {
      newExpanded.delete(title);
    } else {
      newExpanded.add(title);
    }
    setExpandedSections(newExpanded);
  };

  const toggleAll = () => {
    if (expandedSections.size === allSections.length) {
      // All expanded, collapse all
      setExpandedSections(new Set());
    } else {
      // Some or none expanded, expand all
      setExpandedSections(new Set(allSections));
    }
  };

  const allExpanded = expandedSections.size === allSections.length;

  // Show button once user scrolls
  useEffect(() => {
    const handleScroll = () => {
      if (!hasScrolled && containerRef.current && containerRef.current.scrollTop > 0) {
        setHasScrolled(true);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [hasScrolled]);

  // Auto-scroll to Version History if navigated from version number
  useEffect(() => {
    if (location.state?.openVersionHistory && versionHistoryRef.current) {
      setTimeout(() => {
        versionHistoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100); // Small delay to ensure section is rendered expanded
    }
  }, [location.state]);

  // Auto-scroll to training-mode section if hash is present (only once on mount)
  useEffect(() => {
    if (location.hash === '#training-mode' && !hasScrolledToHashRef.current) {
      hasScrolledToHashRef.current = true;
      setTimeout(() => {
        const element = document.getElementById('training-mode');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100); // Small delay to ensure section is rendered expanded
    }
  }, [location.hash]);

  const scrollToTop = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div ref={containerRef} className="screen" style={{ paddingBottom: '32px', position: 'relative' }}>
        {/* Fixed "Top" button - always visible and pinned to viewport */}
        <button
          onClick={scrollToTop}
          style={{
            position: 'fixed',
            top: 'calc(24px + var(--safe-area-top, 0px))',
            right: '24px',
            padding: '6px 10px',
            fontSize: '11px',
            fontWeight: 600,
            background: 'rgba(76, 175, 80, 0.15)',
            color: 'var(--color-success)',
            border: '1px solid rgba(76, 175, 80, 0.3)',
            borderRadius: '12px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            zIndex: 1000,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.background = 'rgba(76, 175, 80, 0.25)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.background = 'rgba(76, 175, 80, 0.15)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
          }}
          aria-label="Scroll to top"
        >
          <span style={{ fontSize: '12px' }}>↑</span>
          Top
        </button>

        <div className="flex-row items-center gap-md" style={{ marginBottom: '24px' }}>
          <button
            className="btn-icon"
            onClick={() => navigate('/')}
            aria-label="Home"
            style={{ color: 'var(--color-accent)' }}
          >
            <HomeIcon />
          </button>
          <h2 style={{ margin: 0, flex: 1 }}>How to Play</h2>
        </div>

      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {/* Why Learn Bird Song */}
        <Section
          title="Why Learn Bird Song?"
          isExpanded={expandedSections.has('Why Learn Bird Song?')}
          onToggle={() => toggleSection('Why Learn Bird Song?')}
        >
          <p style={{ marginBottom: '12px' }}>
            <strong>Birds</strong> are heard more often than they're seen. But, even their sounds can be easy to miss. If you learn their songs, you'll know what to look for - and suddenly your backyard becomes way more interesting.
          </p>
          <p style={{ marginBottom: '12px' }}>
            <strong>ChipNotes</strong> plays sounds separately in your left and right ears. It may seem like a hearing test, but that's birding! You're constantly triangulating: "Cardinal to my left, chickadee to my right, warbler... somewhere up there?" Training your ears to separate simultaneous sounds - like a pianist controlling both hands - dramatically sharpens your field skills.
          </p>
          <p style={{ marginBottom: '12px' }}>
            <strong>Neuroplasticity works:</strong> Your brain rewires with practice. These sound patterns feel impossible at first, but repeated exposure trains your auditory cortex faster than you'd think. Give it a few sessions - you'll be amazed what you can hear.
          </p>
          <p style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
            <strong>Need real-time ID?</strong> Get Cornell's free <a href="https://merlin.allaboutbirds.org/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)' }}>Merlin app</a> - it's magic for "what bird is that singing <em>right now</em>?"
          </p>
        </Section>

        {/* ChipNotes Basics */}
        <Section
          title="ChipNotes Basics"
          isExpanded={expandedSections.has('ChipNotes Basics')}
          onToggle={() => toggleSection('ChipNotes Basics')}
        >
          <p style={{ marginBottom: '12px' }}>
            <strong>Listen. Identify. Tap.</strong>
          </p>
          <p style={{ marginBottom: '12px' }}>
            Bird sounds play through your left or right ear. Identify which bird is singing
            and tap its circle on the correct side before the tile passes the scoring zone.
          </p>
          <p style={{ marginBottom: '12px' }}>
            Each round is 30 seconds. Use headphones for the best experience - unless you want everyone to know you're a bird nerd!
          </p>
          <p style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
            <strong>Mobile tip:</strong> For fullscreen play on iOS, use Safari. On Android Chrome, tap ⋮ → "Add to Home screen" and launch from the icon.
          </p>
        </Section>

        {/* Spectrograms */}
        <Section
          title="The Spectrograms"
          isExpanded={expandedSections.has('The Spectrograms')}
          onToggle={() => toggleSection('The Spectrograms')}
        >
          <p style={{ marginBottom: '12px' }}>
            The colorful images on tiles are spectrograms - visual pictures of sound.
            Time flows left to right, pitch goes bottom to top, and brightness shows volume.
          </p>

          {/* Example spectrogram */}
          <div style={{
            background: 'var(--color-surface)',
            padding: '16px',
            borderRadius: '12px',
            marginBottom: '12px',
          }}>
            <div style={{
              fontSize: '13px',
              fontWeight: 600,
              marginBottom: '8px',
              color: 'var(--color-text-muted)'
            }}>
              Example: Carolina Wren song
            </div>
            <img
              src={`${import.meta.env.BASE_URL}data/spectrograms/CARW_941065.png`}
              alt="Carolina Wren spectrogram - loud, ringing 'teakettle teakettle' song"
              style={{
                width: '100%',
                height: 'auto',
                borderRadius: '8px',
                border: '2px solid rgba(255, 152, 0, 0.3)',
              }}
            />
            <div style={{
              fontSize: '12px',
              color: 'var(--color-text-muted)',
              marginTop: '8px',
              fontStyle: 'italic'
            }}>
              Notice the repeating pattern - this is the Carolina Wren's distinctive "teakettle teakettle" song
            </div>
          </div>

          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
            With practice, you'll recognize birds by their visual patterns too!
          </p>
        </Section>

        {/* Scoring */}
        <Section
          title="Scoring"
          isExpanded={expandedSections.has('Scoring')}
          onToggle={() => toggleSection('Scoring')}
        >
          <ScoreRow label="Perfect" points={100} description="Right bird + right ear + great timing" color="var(--color-success)" />
          <ScoreRow label="Good" points={75} description="Right bird + right ear" color="var(--color-success)" />
          <ScoreRow label="Partial" points={25} description="Right bird, wrong ear" color="var(--color-accent)" />
          <ScoreRow label="Miss" points={0} description="Wrong bird or no response" color="var(--color-error)" />
        </Section>

        {/* The Bird Packs */}
        <Section
          title="The Bird Packs"
          isExpanded={expandedSections.has('The Bird Packs')}
          onToggle={() => toggleSection('The Bird Packs')}
        >
          {/* Custom Pack Builder callout */}
          <div style={{
            marginBottom: '16px',
            padding: '12px 16px',
            background: 'rgba(76, 175, 80, 0.1)',
            borderRadius: '8px',
            borderLeft: '3px solid var(--color-primary)',
          }}>
            <div style={{ fontSize: '14px', color: 'var(--color-text)', lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
              <span style={{ color: '#F5A623', fontSize: '16px', fontWeight: 'bold', flexShrink: 0 }}>+</span>
              <div>
                <strong>Build Your Own Pack:</strong> You can combine any birds from the packs below into custom training sessions. Perfect for drilling problem birds, comparing confusing species, or creating and saving your yard list!
              </div>
            </div>
          </div>

          <PackInfo
            name="Backyard Birds"
            description="Perfect for beginners. 6 distinctive birds you'll hear around your neighborhood: American Crow (AMCR), American Robin (AMRO), Blue Jay (BLJA), Carolina Wren (CARW), Northern Cardinal (NOCA), and Tufted Titmouse (TUTI)."
          />
          <PackInfo
            name="Grassland & Open Country"
            description="10 species of grasslands, prairies, farmland, and field edges: Barn Swallow, Common Yellowthroat, Dickcissel, Eastern Kingbird, Eastern Meadowlark, Field Sparrow, Indigo Bunting, Red-winged Blackbird, Savannah Sparrow, and Yellow Warbler."
          />
          <PackInfo
            name="Eastern Birds"
            description="46 species from the eastern US. 9 birds are selected randomly, and you can shuffle for a new set anytime from the preview screen."
          />
          <PackInfo
            name="Western Birds"
            description="20 common species from western North America: Steller's Jay, California Scrub-Jay, Black-capped Chickadee, White-crowned Sparrow, Common Grackle, Dark-eyed Junco, Red-winged Blackbird, and more."
          />
          <PackInfo
            name="Woodpeckers"
            description="Drums, rattles, and calls. 9 species: Downy, Hairy, Red-bellied, Pileated, Yellow-bellied Sapsucker, Northern Flicker, Red-headed, Acorn, and Lewis's."
          />
          <PackInfo
            name="Sparrows"
            description="Master the subtle singers! 9 sparrow species with distinctive patterns: White-throated, Song, Chipping, Swamp, Savannah, Field, Lincoln's, White-crowned, and House Sparrow."
          />
          <PackInfo
            name="Warbler Academy"
            description="For experts! 34 wood-warbler species with their high-pitched, buzzy songs. 9 warblers are selected randomly—shuffle for a new set anytime."
          />
          <p style={{ marginTop: '16px', fontSize: '13px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
            There are 11,000 birds out there, so more are coming soon. Send your suggestions to{' '}
            <a href="mailto:feedback@chipnotes.app" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
              feedback@chipnotes.app
            </a>
            !
          </p>
        </Section>

        {/* The Levels */}
        <Section
          title="The Levels"
          isExpanded={expandedSections.has('The Levels')}
          onToggle={() => toggleSection('The Levels')}
        >
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
        <Section
          title="Tips"
          isExpanded={expandedSections.has('Tips')}
          onToggle={() => toggleSection('Tips')}
        >
          <Tip>Start with the 6 common birds, even if you're eager for more.</Tip>
          <Tip>
            Visit the{' '}
            <Link to="/pack-select#bird-reference" state={{ fromHelp: true }} style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
              Sound Library
            </Link>
            {' '}to preview all sounds.
          </Tip>
          <Tip>Your birds stay the same between rounds. Hit the shuffle button on the preview screen for a fresh set.</Tip>
          <Tip>Don't rush. Let the sound register before you tap.</Tip>
          <Tip>Check the round summary and confusion matrix to see which birds need practice. If you confused 4+ birds, use the "Drill These Birds" button to immediately practice just those species.</Tip>
          <Tip>Adjust tile speed in Settings if things move too fast (or too slow). Once you're an expert, try playing muted using only spectrograms!</Tip>
        </Section>

        {/* Training Mode */}
        <Section
          id="training-mode"
          title="Training Mode"
          isExpanded={expandedSections.has('Training Mode')}
          onToggle={() => toggleSection('Training Mode')}
        >
          <p>
            Training Mode shows bird icons and species codes on each tile alongside the spectrogram - perfect for learning which sounds belong to which birds.
          </p>
          <p>
            You can enable it on the preview screen before starting a round, or toggle it on/off anytime during gameplay using the <strong>eye icon</strong> (next to the back button). Start with labels visible, then toggle off to challenge yourself!
          </p>
          <div style={{
            background: 'var(--color-surface)',
            padding: '12px',
            borderRadius: '8px',
            marginTop: '12px',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              background: 'rgba(76, 175, 80, 0.3)',
              border: '2px solid rgba(76, 175, 80, 0.6)',
              borderRadius: '50%',
              color: '#81C784',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>Eye icon glows green when Training Mode is ON</span>
          </div>
        </Section>

        {/* Taxonomic Sorting */}
        <Section
          title="Taxonomic Sorting"
          isExpanded={expandedSections.has('Taxonomic Sorting')}
          onToggle={() => toggleSection('Taxonomic Sorting')}
        >
          <p>
            Taxonomic sorting can be toggled on and off throughout the game - on the preview screen, in Sound Library sections, in the Custom Pack Builder, and during gameplay. When enabled, birds appear in phylogenetic order with scientific names instead of alphabetically. 🐦🤓
          </p>
          <p style={{ marginTop: '12px' }}>
            Birds are sorted by their position on the evolutionary tree (using the 2025 eBird/AOS taxonomy), and common names are replaced with <em>scientific names in italics</em>. Perfect for learning evolutionary relationships!
          </p>
          <p style={{ marginTop: '12px' }}>
            Most beginners stick with alphabetical sorting during gameplay - it's faster to find birds by their 4-letter codes. But as you advance, you might prefer taxonomic sorting everywhere, building muscle memory based on evolutionary relationships. Either way works - you're training your brain to recognize patterns!
          </p>
          <div style={{
            background: 'var(--color-surface)',
            padding: '12px',
            borderRadius: '8px',
            marginTop: '12px',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              background: 'rgba(100, 181, 246, 0.3)',
              border: '2px solid rgba(100, 181, 246, 0.6)',
              borderRadius: '50%',
              color: '#64B5F6',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>Toggle glows blue when Taxonomic Sorting is ON</span>
          </div>
        </Section>

        {/* Bird Codes */}
        <Section
          title="The 4-Letter Codes"
          isExpanded={expandedSections.has('The 4-Letter Codes')}
          onToggle={() => toggleSection('The 4-Letter Codes')}
        >
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
            <div style={{ marginTop: '12px', fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
              There <a href="https://www.birdpop.org/pages/birdSpeciesCodes.php" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>are exceptions</a>. Because, ornithology. And when species collide (generating identical codes), things get <a href="https://www.carolinabirdclub.org/bandcodes.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>even messier</a>.
            </div>
          </div>
        </Section>

        {/* About & Credits */}
        <Section
          title="About & Credits"
          isExpanded={expandedSections.has('About & Credits')}
          onToggle={() => toggleSection('About & Credits')}
        >
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎧 🐦 🎵 ❤️</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>
              Created by Peter Repetti
            </div>
            <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              Made with love by bird nerds, for bird nerds
            </div>
          </div>

          <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            <p style={{ marginBottom: '12px' }}>
              <strong style={{ color: 'var(--color-accent)' }}>Bird sounds:</strong> Sourced from{' '}
              <a href="https://xeno-canto.org" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
                Xeno-Canto
              </a>
              , the{' '}
              <a href="https://www.macaulaylibrary.org" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
                Cornell Macaulay Library
              </a>
              {' '}and from user contributions. All sound clips have attribution with XC catalog numbers and recordist names in the Sound Library (expand any species on the{' '}
              <Link to="/pack-select#bird-reference" state={{ fromHelp: true }} style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
                Pack Select
              </Link>
              {' '}screen).
            </p>

            <p style={{ marginBottom: '12px' }}>
              <strong style={{ color: 'var(--color-accent)' }}>Bird icons:</strong> Designed by Peter Repetti with assistance from Claude and ChatGPT (DALL-E 3).
            </p>

            <p style={{ marginBottom: '12px' }}>
              <strong style={{ color: 'var(--color-accent)' }}>The Tech:</strong> Built by Claude Code with TypeScript, React, and PixiJS for buttery-smooth scrolling spectrograms. The Web Audio API handles sample-accurate playback with real-time stereo panning - your browser decodes and buffers audio into memory for zero-latency triggering. Vite bundles it all into a PWA (Progressive Web App) that caches sounds as you play them - so load up those birds before your flight to New Zealand takes off ✈️.
            </p>

            <p style={{ marginBottom: '12px' }}>
              <strong style={{ color: 'var(--color-accent)' }}>Special thanks:</strong> To the global birding community for sharing these recordings.
            </p>

            <p style={{ marginTop: '16px', fontSize: '13px', fontStyle: 'italic' }}>
              Good birding! 🐦
            </p>
          </div>
        </Section>

        {/* Support This Project */}
        <Section
          title="Support This Project"
          isExpanded={expandedSections.has('Support This Project')}
          onToggle={() => toggleSection('Support This Project')}
        >
          <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: '16px' }}>
            ChipNotes is free,{' '}
            <a
              href="https://github.com/chrysogonum/bird-sound-game"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}
              onClick={() => trackExternalLinkClick('https://github.com/chrysogonum/bird-sound-game', 'github_repo', 'help_page')}
            >
              open source
            </a>
            , and built as a passion project. If it's helped you level-up your birding skills, consider{' '}
            <a
              href="https://ko-fi.com/chipnotes"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}
              onClick={() => trackExternalLinkClick('https://ko-fi.com/chipnotes', 'donation', 'help_page')}
            >
              supporting development
            </a>
            {' '}- your donations help me add new species, add features, and do more birding. Now, you go build something cool - it might be easier than you think! ;)
          </p>

          <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: '8px', fontWeight: 600 }}>
            Please also consider supporting the organizations that make this possible, and tell them ChipNotes! sent you:
          </p>
          <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--color-text-muted)', lineHeight: 1.8 }}>
            <li>
              <a href="https://www.birds.cornell.edu/home/support/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
                https://www.birds.cornell.edu/home/support/
              </a>
              {' '}- Incredible bird sound archive
            </li>
            <li>
              <a href="https://xeno-canto.org/about/donate" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
                https://xeno-canto.org/about/donate
              </a>
              {' '}- Community-driven bird recording database
            </li>
          </ul>

          <p style={{ marginTop: '16px', fontSize: '14px', fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
            Thank you for learning with me! 🐦
          </p>
        </Section>

        {/* Feedback & Contact */}
        <Section
          title="Feedback & Bug Reports"
          isExpanded={expandedSections.has('Feedback & Bug Reports')}
          onToggle={() => toggleSection('Feedback & Bug Reports')}
        >
          <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: '16px' }}>
            I'd love to hear from you! Found a bug? Have a feature suggestion? Want to share your experience?
          </p>
          <div style={{
            background: 'var(--color-surface)',
            padding: '16px',
            borderRadius: '12px',
            marginBottom: '12px'
          }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: 'var(--color-accent)' }}>
              📧 Email
            </div>
            <a
              href="mailto:feedback@chipnotes.app"
              style={{
                color: 'var(--color-text)',
                textDecoration: 'none',
                fontSize: '14px',
              }}
            >
              feedback@chipnotes.app
            </a>
          </div>
          <div style={{
            background: 'var(--color-surface)',
            padding: '16px',
            borderRadius: '12px'
          }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: 'var(--color-accent)' }}>
              🐛 GitHub Issues
            </div>
            <a
              href="https://github.com/chrysogonum/bird-sound-game/issues"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--color-text)',
                textDecoration: 'none',
                fontSize: '14px',
              }}
              onClick={() => trackExternalLinkClick('https://github.com/chrysogonum/bird-sound-game/issues', 'github_issues', 'help_page')}
            >
              github.com/chrysogonum/bird-sound-game/issues
            </a>
          </div>
        </Section>

        {/* Version History */}
        <div ref={versionHistoryRef}>
          {/* Recent Updates - Always Visible */}
          <div className="card" style={{ marginBottom: '16px', background: 'rgba(255, 152, 0, 0.08)', border: '1px solid rgba(255, 152, 0, 0.3)' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', color: 'var(--color-accent)' }}>🎯 Recent Updates</h4>
            <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', lineHeight: 1.8 }}>
              <div>🎉 <strong>100+ Species!</strong> – Over 100 North American species with curated audio clips and spectrograms</div>
              <div>🔄 <strong>Drill Confused Birds</strong> – After a round, instantly practice just the birds you mixed up</div>
              <div>📱 <strong>Tablet Support</strong> – Now works (better) on bigger screens like iPads and tablets</div>
              <div>📦 <strong>Pack Expansions</strong> – New Grassland pack (10 species), plus Western Birds expanded to 20, Eastern to 46, and Woodpeckers to 9</div>
              <div>🐦 <strong>Taxonomic Sorting</strong> – Play birds in evolutionary order, see scientific names</div>
              <div>🎨 <strong>Custom Pack Builder</strong> – Build and save up to 10 custom packs from any species</div>
            </div>
          </div>

          {/* Full Version History - Collapsible */}
          <Section
            title="Full Version History"
            isExpanded={expandedSections.has('Full Version History')}
            onToggle={() => toggleSection('Full Version History')}
          >
          <VersionEntry version="3.56" date="January 24, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Drill Confused Birds:</strong> After a round, if you confused 4+ different birds, a new "Drill These X Birds" button appears in the Confusion Summary. Click it to immediately start a focused practice session with just those species - the fastest way to improve on your trouble areas.</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.55" date="January 24, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Tablet Support:</strong> ChipNotes now scales up on iPad and other tablets. UI elements are 1.4x larger on screens 768px+, making buttons easier to tap and spectrograms easier to see.</li>
              <li><strong>Gameplay Bird Grid:</strong> Bird selection icons now display in consistent 3-column layout on tablets (previously wrapped to 6+3), with larger icons (52px vs 36px) and improved spacing for easier tapping during gameplay.</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.54" date="January 23, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>New Pack: Grassland & Open Country:</strong> Added new 10-species pack featuring birds of grasslands, prairies, farmland, and field edges. Includes Indigo Bunting, Eastern Kingbird, Barn Swallow, Eastern Meadowlark, Dickcissel, Red-winged Blackbird, Savannah Sparrow, Field Sparrow, Common Yellowthroat, and Yellow Warbler - 30 new audio clips and spectrograms.</li>
              <li><strong>Pack Curation Improvements:</strong> Added Red-winged Blackbird to Grassland pack (iconic grassland/wetland species). Added Common Grackle and Dark-eyed Junco to Western Birds pack (common transcontinental species). Western Birds pack expanded from 18 to 20 species.</li>
              <li><strong>Species Icon Additions:</strong> Added bird icons for all 5 new grassland species (BARS, DICK, EAKI, EAME, INBU) - now available in Bird Reference and Custom Pack Builder.</li>
              <li><strong>Yellow Warbler Addition:</strong> Added Yellow Warbler (YEWA) to Warbler Academy pack alongside the new grassland pack - versatile species found in both habitats.</li>
              <li><strong>Common Yellowthroat Canonical Update:</strong> Changed signature clip from XC1013902 to XC1021804 for improved audio quality.</li>
              <li><strong>Help Page Enhancements:</strong> Added link to Carolina Bird Club's 4-letter code article in "The 4-Letter Codes" section explaining code collisions and exceptions. Updated Custom Pack Builder callout to emphasize "creating and saving your yard list" use case. Made Backyard Birds description more inclusive ("around your neighborhood" vs "in your own backyard").</li>
              <li><strong>Repository Cleanup:</strong> Removed temporary candidate folders from data directory (~13.6 MB) after clips were merged into game - cleaner project structure.</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.53" date="January 22, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Pack Select Page Redesign:</strong> Moved Custom Pack Builder to top of page (above pack grid), made it collapsible with "See examples" link for cleaner layout while maintaining discoverability.</li>
              <li><strong>Sound Library Branding:</strong> Unified Sound Library icon to 🎧📚 (headphones + books) across all screens - appears in Pack Select header, Level Select, and Ready to Play screens for consistent visual identity.</li>
              <li><strong>Level Select Cleanup:</strong> Simplified header by moving Sound Library link to icon-only button positioned near Home icon, removed redundant text for cleaner interface.</li>
              <li><strong>Pack Select Flow:</strong> Removed redundant scroll hint below packs (already mentioned in intro bullets), streamlined page flow from intro → Custom Pack → packs → Sound Library.</li>
              <li><strong>Pack Select Intro:</strong> Refined "young Grasshopper" joke bullet point with SAVS sparrow icon for better visibility and clearer birding reference (Grasshopper Sparrow species).</li>
              <li><strong>Custom Pack Builder Pack Filters:</strong> Added pack-based filtering chips (All Birds, Backyard, Eastern, Sparrows, Warblers, Woodpeckers, Western) above search bar. Click any pack to filter species grid to only birds in that pack. Combines with text search for powerful filtering like "all warblers with 'yellow' in name". Fully dynamic - auto-updates when pack definitions change.</li>
              <li><strong>Custom Pack Builder Card Density:</strong> Reduced bird card sizes ~30% (140px → 110px width) and optimized spacing throughout for better mobile efficiency. Shows more birds without scrolling. Reduced font size from 12px → 11px, improved text contrast with pure white species names and bold 4-letter codes for better readability.</li>
              <li><strong>Version Navigation:</strong> Clicking version number on main menu now navigates to Recent Updates section instead of auto-expanding Full Version History - better UX for discovering latest features.</li>
              <li><strong>Recent Updates Header:</strong> Simplified to just "🎯 Recent Updates" without version range for cleaner presentation.</li>
              <li><strong>Analytics Tracking:</strong> Added Google Analytics tracking for Ko-fi donation link clicks, GitHub repository link clicks, and GitHub Issues link clicks to understand external link engagement and donation funnel.</li>
              <li><strong>Open Source Transparency:</strong> Added clickable GitHub repository links to "open source" mentions in Help and Settings pages for easy access to source code.</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.52" date="January 22, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Custom Pack Builder Promotion:</strong> Added prominent callout box in Help page "The Bird Packs" section highlighting the ability to combine birds from any pack into custom training sessions.</li>
              <li><strong>Section Rename:</strong> Renamed "The Packs" section to "The Bird Packs" for clarity.</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.51" date="January 22, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Help Page Reorganization:</strong> Moved "The Spectrograms" section to appear just before "Scoring" section for better logical flow - spectrograms are introduced early as a core learning concept.</li>
              <li><strong>Spectrograms Section Enhancement:</strong> Added visual example showing Carolina Wren canonical spectrogram with caption explaining the distinctive "teakettle teakettle" repeating pattern - makes the concept concrete for new users.</li>
              <li><strong>Help Page UX:</strong> Changed default expanded sections - "Scoring" now starts collapsed to reduce initial information overload, keeping focus on "Why Learn Bird Song?" and "ChipNotes Basics".</li>
              <li><strong>Main Menu Discoverability:</strong> Bottom navigation icons now include text labels ("How To", "Settings", "Stats") and are slightly larger for improved discoverability and clarity.</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.50" date="January 22, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Custom Pack: "Save Before Play" Prompt:</strong> When clicking "Start" with an unsaved custom pack, users are now prompted to save before playing. Options include "Save & Play" (opens save dialog then plays), "Just Play" (plays immediately without saving), or "Cancel". Temporary packs are automatically cleared when returning to the builder, providing a clean slate.</li>
              <li><strong>Custom Pack: Rename & Update Improvements:</strong> Redesigned save dialog for editing existing packs. Users can now rename packs by updating the name in the save dialog - the "Update [Pack Name]" button updates the existing pack with the new name and species. Added "Save As New Pack" option to create variants while preserving the original pack.</li>
              <li><strong>Navigation Consistency:</strong> All back arrows throughout the game are now orange for visual consistency. Gameplay back button now returns to level select (not home page) for better flow. Home icons always return to main menu.</li>
              <li><strong>High Contrast Setting Removed:</strong> Removed ineffective high contrast setting from Settings page - the effect was too subtle to be useful for accessibility.</li>
              <li><strong>Icon Credits Added:</strong> Added attribution for bird icon design in About & Credits section - icons designed by Peter Repetti with assistance from Claude and ChatGPT (DALL-E 3).</li>
              <li><strong>YBSA Canonical Update:</strong> Changed Yellow-bellied Sapsucker canonical clip from XC1011116 to XC663258 for improved audio quality.</li>
              <li><strong>Pack Select Text Polish:</strong> Changed "6 levels/pack" to "6 levels per pack" for improved readability in Quick Tips section.</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.49" date="January 21, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Custom Pack "Play Again" Fix:</strong> Fixed Custom Pack behavior to match regular packs - clicking "Play Again" after completing a round now keeps the same 9 birds instead of shuffling to a new random selection. Previously, custom packs with more than 9 birds would re-shuffle on every "Play Again", breaking the practice loop.</li>
              <li><strong>Navigation Consistency:</strong> Unified navigation across all screens with orange home icons - Pack Select, Settings, Help, Progress, and Level Select pages now all feature consistent small orange home icons in upper corners for quick navigation back to menu or pack selection.</li>
              <li><strong>Help Page Restructure:</strong> "Recent Updates" card now always visible at top of Help page, with "Full Version History" collapsible below. Improved discoverability of latest features without requiring users to expand sections.</li>
              <li><strong>Text Improvements:</strong> Pack descriptions updated for grammatical consistency (numeric formatting, removed redundant words). Section renamed from "The Basics" to "ChipNotes Basics" throughout Help page.</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.48" date="January 21, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Western Birds Pack Expansion:</strong> Western Birds pack expanded from 14 to 18 species with Wrentit, Spotted Towhee, Western Bluebird, and Acorn Woodpecker (14 new audio clips and spectrograms). Pack now includes distinctive western species across jays, finches, towhees, bluebirds, and woodpeckers.</li>
              <li><strong>Pack Display Fix:</strong> Fixed Western Birds levels to display 9 species on wheel (randomly selected from full pool of 18), matching behavior of other large packs like Eastern Birds. Previously showed all 17 species causing UI overflow.</li>
              <li><strong>Schema Updates:</strong> Increased level schema maximum species_count from 12 to 20 to accommodate growing pack sizes while maintaining 9-species wheel limit for optimal gameplay.</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.47" date="January 21, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Two New Woodpeckers Added:</strong> Woodpeckers pack expanded from 7 to 9 species with Acorn Woodpecker and Lewis's Woodpecker. Both western species with distinctive vocalizations.</li>
              <li><strong>Pack Select UX Improvements:</strong> Added fifth tip bullet pointing users to custom pack builder feature below with pointing emoji. Updated timer anxiety tip for clarity. Pack descriptions updated to reflect new species counts.</li>
              <li><strong>Merge Candidates Script Fix:</strong> Fixed <code>merge_candidates.py</code> to generate proper hash-based clip_ids (matching existing pattern) instead of flawed XC-based IDs. Future bird additions will now have correct unique identifiers from the start.</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.46" date="January 21, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>House Sparrow Added:</strong> Sparrows pack now includes 9 species with House Sparrow (3 new audio clips and spectrograms). Common urban sparrow found across North America.</li>
              <li><strong>Audio Clip Curation:</strong> Trimmed Swamp Sparrow canonical song clip to remove interfering bird at end. Updated canonical clip selection for improved audio quality.</li>
              <li><strong>Critical Safety Improvements:</strong> Deleted dangerous <code>audio_tagger.py</code> script that destroyed curated metadata. All workflows now use safe <code>merge_candidates.py</code> for adding clips. Updated <code>/add-bird</code> workflow with auto-updating species_count and stronger warnings about following documented steps.</li>
              <li><strong>Workflow Documentation:</strong> Added prominent warnings to <code>/add-bird</code> command documenting common failure modes (missing species_count updates, UI pack count mismatches, browser cache issues).</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.45" date="January 21, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Red-eyed Vireo Added:</strong> Eastern Birds pack now includes 46 species with Red-eyed Vireo (5 new audio clips and spectrograms). One of the most common forest songbirds in eastern North America.</li>
              <li><strong>Add-Bird Workflow Improvements:</strong> New automated pack count validation tool prevents UI species count mismatches. Script detects and auto-fixes hardcoded counts in PackSelect and Help screens with <code>--fix</code> flag, integrated into add-bird workflow as Step 6c.</li>
              <li><strong>Attribution Bug Fix:</strong> Fixed merge_candidates.py to generate clickable Xeno-canto source URLs for all new bird additions. Recordist names now appear as proper links in Bird Reference.</li>
              <li><strong>Pack Data Consistency:</strong> Synced species arrays in expanded_backyard pack definition for clearer data structure (species and display_species now both contain all 46 birds).</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.44" date="January 21, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Documentation Updates:</strong> Updated Eastern Birds pack count from 40 to 45 in Help page, and clarified Training Mode can be enabled before or during gameplay.</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.43" date="January 21, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Bird Reference Attribution Overhaul:</strong> Improved clip source attribution system with clear categorization (Xeno-canto, Cornell Macaulay, User-contributed). Compact display format shows "XC667361 • Nick Komar" with clickable links to original Xeno-canto recordings. Recovered 363 lost recordist attributions and corrected 78 vocalization type errors from earlier data migration.</li>
              <li><strong>Source Transparency:</strong> Every clip now clearly shows its origin - Xeno-canto (with catalog number link), Cornell CD track number, or user-contributed recordings. Enables proper attribution to recordists and easy access to original recordings for deeper learning.</li>
              <li><strong>Metadata Protection:</strong> Enhanced git pre-commit hooks now protect recordist attributions and vocalization type classifications (song/call/drum) in addition to canonical flags, preventing future accidental data loss during bulk operations.</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.42" date="January 21, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>5 New Eastern Birds:</strong> Eastern Birds pack from 40 to 45 species with White-eyed Vireo, Acadian Flycatcher, Eastern Phoebe, Great Crested Flycatcher, and Eastern Wood-Pewee (24 new audio clips and spectrograms).</li>
              <li><strong>Data Integrity Safeguards:</strong> Added comprehensive protection for canonical clip flags (Bird Reference signature indicators) including git pre-commit hooks, extensive documentation, and automated validation to prevent accidental data loss.</li>
              <li><strong>Audio Quality Improvements:</strong> Trimmed dead space from multiple clips for cleaner, more focused bird vocalizations.</li>
              <li><strong>Pack Count Corrections:</strong> Updated Eastern Birds pack display to correctly show 45 species across all UI locations.</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.41" date="January 20, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Dark-eyed Junco added:</strong> Eastern Birds pack now includes 40 species (previously 39) with Dark-eyed Junco clips and spectrograms.</li>
              <li><strong>Level rotation fix:</strong> Fixed bug where newly added species appeared in pack definitions but not in gameplay rotation - Dark-eyed Junco now appears in all 6 levels.</li>
              <li><strong>Species count corrections:</strong> Updated pack selection and help text to reflect accurate species counts.</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.40" date="January 20, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Custom Pack Editing:</strong> Load, edit, and update existing saved packs! When you load a pack and modify it, you can choose to update the original pack or save as a new one. Visual indicator shows "Editing: [Pack Name]" at the top of the builder.</li>
              <li><strong>Custom Pack Expansion:</strong> Increased max pack size from 9 to 30 birds! For packs with 10+ birds, the game randomly selects 9 for each round with a re-roll button to shuffle the selection. Perfect for creating comprehensive regional packs like "All Midwest Warblers" or "Backyard Regulars."</li>
              <li><strong>Custom Pack UX:</strong> Made entire bird card clickable (not just the icon) for easier selection, added 4-letter species codes below bird names in taxonomic sort mode, and improved button labels to show "Update / Save As New" when editing.</li>
              <li><strong>Spectrogram Fix:</strong> Fixed missing spectrograms for species updated in 2025 AOS taxonomy (American Goldfinch, Cedar Waxwing, California Scrub-Jay, Savannah Sparrow) - all 415 clips now have working visual tiles.</li>
              <li><strong>Preview Screen UX:</strong> Made Training Mode and Taxonomic Sort toggle boxes more visible with subtle background and borders in inactive state.</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.39" date="January 20, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Custom Pack Builder: Separated Controls:</strong> Redesigned bird cards with distinct touch areas - play button (▶) on left for audio preview, bird icon on right for add/remove. No more overlapping actions!</li>
              <li><strong>Custom Pack Builder: Saved Packs:</strong> Save up to 10 named custom packs (e.g., "My Backyard", "Lake Erie Migrants") with persistent localStorage storage. Saved packs appear in a collapsible section with load/delete buttons for easy management across sessions.</li>
              <li><strong>Custom Pack Builder: Pack Validation & Versioning:</strong> Saved packs now auto-validate species codes on load - if birds are removed from the game due to taxonomy updates, you'll see a friendly warning and the pack auto-cleans invalid entries. Includes version field for future migrations and backward compatibility with legacy packs.</li>
              <li><strong>Custom Pack Builder: Mobile Touch Fix:</strong> Fixed delete button not working on mobile devices - replaced native browser confirm() dialog (which was being blocked on touch) with custom modal dialog that works reliably across all devices and screen sizes.</li>
              <li><strong>Custom Pack Builder: Taxonomic Sorting:</strong> Added taxonomic sort toggle (📊 Taxonomic 🐦🤓) to group birds by evolutionary relationships - perfect for adding related species like all woodpeckers, corvids, or comparing warbler genera. Displays scientific names in italic when active.</li>
              <li><strong>Custom Pack Builder: Smart Search:</strong> Search behavior now adapts - single match (e.g., "cardinal") auto-clears for next search; multiple matches (e.g., "warbler") keeps filter active so you can select multiple birds from the same group</li>
              <li><strong>Help Page Navigation:</strong> Repositioned floating buttons for better UX - small "← Back" button on bottom left, "Expand/Collapse All" and "↑ Top" grouped on bottom right. All buttons now consistently styled and only appear after scrolling.</li>
              <li><strong>Pack Suggestions:</strong> Added note in Packs section: "There are 11,000 birds out there, so more are coming soon" with feedback email link</li>
              <li><strong>Branding Consistency:</strong> Standardized "ChipNotes!" (with !) for logos/titles/first mentions, "ChipNotes" (no !) for prose and mid-sentence references</li>
              <li><strong>Support Section Harmonized:</strong> Updated Help and Settings "Support This Project" sections with consistent messaging emphasizing open source nature and attribution to Cornell/Xeno-Canto</li>
              <li><strong>PWA Safe Area Fix:</strong> Fixed content bleeding into iOS status bar on PreRoundPreview screen when installed as home screen app</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.38" date="January 20, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Taxonomy Migration:</strong> Updated all bird species codes to 2025 AOS/IBP taxonomy - migrated 5 codes (AMGO→AGOL, CEWA→CEDW, SASP→SAVS, WESJ→CASJ, EWPE→EAWP) and fixed species names to match current ornithological standards</li>
              <li><strong>Data Audit System:</strong> Added comprehensive species data validation tools to ensure 100% consistency between game data and the authoritative IBP-AOS-list25.csv taxonomy reference</li>
              <li><strong>Bug Fix:</strong> Fixed taxonomic sort toggle re-shuffling birds on preview screen - now correctly re-orders existing birds without selecting new random ones</li>
              <li><strong>Preview Screen Redesign:</strong> Completely overhauled "Ready to Play" page for better space efficiency - compact header, side-by-side toggles, larger bird grid visibility, and new tip box explaining grid positions</li>
              <li><strong>Training Mode Visual Update:</strong> Training mode toggle now highlights in green (instead of orange) for better visual distinction from other controls</li>
              <li><strong>Sort Button Clarity:</strong> Alphabetical sort now displays as "Sort" by default, switching to "Taxonomic 🐦🤓" when phylogenetic ordering is active</li>
              <li><strong>Bird Reference Quick Access:</strong> Added 📚 book icon button on preview screen that jumps directly to the pack's Bird Reference section with auto-expansion - includes "Ready to Play?" button for easy return</li>
              <li><strong>Help Page Navigation:</strong> Added paired navigation buttons in bottom-right corner: green "↑ Top" for scroll-to-top and orange "Expand/Collapse All" for section management</li>
              <li><strong>Preview Instructions:</strong> Updated preview text to "Tap to preview signature song. Press and hold to get a closer look!" for clearer user guidance</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.37" date="January 19, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Help Documentation:</strong> Added dedicated "Taxonomic Sorting" section to Help page - explains phylogenetic ordering, scientific name display, and how the feature works during gameplay</li>
              <li><strong>README Update:</strong> Fixed Backyard Birds species count (5→6, added Robin) and updated version number</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.36" date="January 19, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Taxonomic Sort Toggle:</strong> Added taxonomic/alphabetical sort toggle to pre-round preview screen - when enabled, shows birds in phylogenetic order with scientific names (italicized) instead of common names 🐦🤓</li>
              <li><strong>Button Sort Persistence:</strong> Species buttons during gameplay now respect taxonomic sort preference, making it easier for taxonomically-inclined players to build muscle memory</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.35" date="January 19, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>2025 AOS Taxonomy:</strong> Updated all 86 species to official 2025 American Ornithological Society (66th Supplement) taxonomic positions - fixes phylogenetic ordering across all families, especially warblers (Swainson's Warbler now correctly appears before Setophaga radiation)</li>
              <li><strong>Scientific Names Fix:</strong> Corrected numerous errors in displayed scientific names - WEWA now shows <em>Helmitheros vermivorum</em> (not <em>Setophaga pensylvanica</em>!), plus 13+ other species fixed to match 2025 AOS data</li>
              <li><strong>Species Data File:</strong> Added comprehensive species.json with common names, scientific names, genus, species epithet, and taxonomic order for all birds - auto-generated from authoritative IBP-AOS-list25.csv</li>
              <li><strong>Custom Pack Builder Icons:</strong> Replaced generic circles with cute illustrated bird icon images - makes custom pack building more visual and fun!</li>
              <li><strong>Data Source:</strong> All taxonomy from The Institute for Bird Populations' official 2025 AOS list (2352 taxa) - scientifically accurate and up-to-date</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.34" date="January 19, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Scientific Names:</strong> Bird Reference now shows scientific names (italicized) below common names when sorted taxonomically - perfect for learning phylogenetic relationships!</li>
              <li><strong>Pack Select UX:</strong> Enhanced grasshopper sparrow joke to read "6 levels/pack—start @ #1, 🦗 sparrow" - more punchy and visual</li>
              <li><strong>OCWA Clips:</strong> Added 7 new Orange-crowned Warbler clips from Xeno-Canto (6 songs, 1 call) - all quality A recordings for expanded species coverage</li>
              <li><strong>Audio Quality:</strong> Trimmed OCWA_985696 to remove interfering bird vocalization at beginning - now shows clean warbler song only</li>
              <li><strong>Data Fixes:</strong> Removed duplicate OCWA_1046368 entry in clips database, set OCWA_976251 as canonical clip, removed low-quality SASP_1060896 clip</li>
              <li><strong>Home Page:</strong> Tightened spacing between title and tagline for better visual balance</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.33" date="January 19, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Taxonomic Sort:</strong> Bird Reference now supports eBird/Clements 2025 taxonomic order - toggle between alphabetical and phylogenetic sorting with a fun easter egg for the science nerds</li>
              <li><strong>Species Fixes:</strong> Corrected Carolina Wren code from CAWR to CARW, and Barred Owl from BADO to BAOW - now matches eBird standard across all packs and data files</li>
              <li><strong>American Robin:</strong> Added AMRO to starter pack (now 6 birds) - merged PR #4 with Cornell/Macaulay Library attribution</li>
              <li><strong>Pack Naming:</strong> Simplified "Common Eastern US Backyard Birds" to just "Backyard Birds" everywhere</li>
              <li><strong>Help Page Polish:</strong> Alphabetized bird list in pack descriptions, added "There are exceptions. Because, ornithology." note to 4-letter codes section</li>
              <li><strong>Help Navigation Fix:</strong> Fixed unwanted auto-scroll when expanding sections after navigating from Pack Select with hash links</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.32" date="January 18, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Pack Select UX:</strong> Simplified intro bullets with direct links to Help (Training Mode section) and Settings - reduced text, added helpful navigation</li>
              <li><strong>Back Button Enhancement:</strong> Made back buttons more prominent on Help and Settings pages (orange color, "Back" text instead of just icon) for better PWA navigation visibility</li>
              <li><strong>Settings Copy:</strong> Updated Support section with friendlier wording</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.31" date="January 18, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Bird Reference Link:</strong> Made "Bird Reference" in Tips section clickable - now all references to Pack Select have proper back navigation in PWA mode!</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.30" date="January 18, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>PWA Navigation Fix:</strong> Added "Back to Help" button on Bird Reference screen when navigated from Help page's About & Credits section - complete PWA navigation coverage!</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.29" date="January 18, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>PWA Navigation Enhancement:</strong> Added "Back to Level Select" button on Bird Reference screen when navigated from Level Select - no more getting stuck in PWA mode!</li>
              <li><strong>Rejection tracking system:</strong> Clips rejected during review are now logged to prevent re-downloading - no more duplicate review efforts!</li>
              <li><strong>Yellow-rumped Warbler (YRWA) quality improvements:</strong> Curated down to 2 high-quality clips (from 14 candidates) - improved from Q3 to Q4 with better song/call diversity</li>
              <li><strong>Cedar Waxwing (CEWA) audit:</strong> Reviewed and optimized clip selection for better quality and vocalization diversity</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.28" date="January 18, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Bird Reference Navigation:</strong> Added contextual "Bird Reference" link from Level Select screen that jumps directly to the selected pack's bird list - easily review sounds before starting a level</li>
              <li><strong>Improved Xeno-canto Attribution:</strong> Now displays XC catalog numbers (e.g., "XC1015145 - David A. Brinkman") for proper credit and licensing compliance</li>
              <li><strong>Deep Linking:</strong> Navigate directly to Bird Reference section from Help page with smooth scrolling</li>
              <li><strong>Pack Auto-Expansion:</strong> When navigating from Level Select, the relevant pack automatically expands in Bird Reference</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.27" date="January 18, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Share Card UX:</strong> Improved share instructions with upward arrow emoji and clearer text "Press and hold the image above" to prevent confusion</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.26" date="January 18, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>PWA Home Screen Fix:</strong> Fixed 404 error when adding ChipNotes to iPhone home screen - start_url now correctly points to root path</li>
              <li><strong>Manifest Update:</strong> Updated PWA description to match new tagline "Train your ear. Know the birds."</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.25" date="January 18, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Home Screen Refresh:</strong> New tagline "Train your ear. Know the birds." emphasizes the educational journey and real-world birding payoff</li>
              <li><strong>Enhanced Visual Flow:</strong> Added 3-step "Hear → Match → Train" diagram with brain icon to clearly show the learning process</li>
              <li><strong>Cleaner Layout:</strong> Redesigned home screen with tighter spacing and more intuitive visual hierarchy</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.24" date="January 18, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Share Card Polish:</strong> Refined share card design with circular bird icons and owl mascot, cleaner font hierarchy (removed monospace, reduced bold usage), and improved spacing for better visual balance</li>
              <li><strong>Icon Improvements:</strong> Bird icons and owl now display as perfect circles with proper aspect ratio scaling - no more white backgrounds or distortion</li>
              <li><strong>Layout Refinement:</strong> Moved Best Streak above bird icons, tightened spacing between pack/level and bird codes, centered text better in available space</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.23" date="January 17, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Share Score Card:</strong> New shareable score card feature - download or share your round results with fun bird icons, stats, and confusion matrix highlights</li>
              <li><strong>Custom Domain:</strong> ChipNotes now available at <a href="https://chipnotes.app" style={{ color: 'var(--color-accent)' }}>chipnotes.app</a> - easier to remember and share!</li>
              <li><strong>Training Mode indicator:</strong> Share cards now show when Training Mode was used during the round</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.22" date="January 17, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Version chronology fix:</strong> Moved v3.02 and v3.03 to correct position in version history (after v3.13, before v2.0) - no more time-traveling versions!</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.21" date="January 17, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>All Birds pack race condition fix:</strong> Fixed state management bug where pack JSON loading overwrote the All Birds pack, causing it to disappear - now merges state correctly to preserve all packs</li>
              <li><strong>Clickable version number:</strong> Main menu version now links to Version History - auto-expands and scrolls to changelog</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.20" date="January 17, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Service worker cache fix:</strong> Fixed "Twilight Zone" bug where All Birds pack appeared on first load but disappeared after refresh - hashed JS bundles no longer cached, ensuring fresh code always loads</li>
              <li><strong>PWA stability:</strong> Installed PWAs now properly update to show latest changes without requiring reinstall</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.19" date="January 17, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Version numbering fix:</strong> Renamed v3.4 to v3.19 to maintain sequential ordering - fixes Apple-style confusion where 3.4 appeared after 3.18</li>
              <li><strong>Help page UX:</strong> Collapsible sections with floating Expand All button - less scrolling, more scanning</li>
              <li><strong>All Birds reference:</strong> Fixed missing bird icons in Bird Reference pack</li>
              <li><strong>Navigation improvements:</strong> Added Back button at bottom of Help page, Help link in Settings for easy cross-navigation</li>
              <li><strong>Support link:</strong> Ko-fi donation link added to Settings - buy me a coffee if ChipNotes helps you ID more birds</li>
              <li><strong>Tech description restored:</strong> Brought back the detailed tech paragraph about TypeScript, React, PixiJS, and PWA offline caching</li>
              <li><strong>Privacy language:</strong> Updated Settings privacy text to be more neutral and less "we"-focused, "not stalking you" instead of "them"</li>
              <li><strong>Credits update:</strong> Added Cornell Macaulay Library, user contributions, and Bird Reference attribution</li>
              <li><strong>Project timeline:</strong> Documented creation timeline (Jan 8-11, 2026) and Claude Code collaboration</li>
              <li><strong>Voice consistency:</strong> Changed "we" to "I" in Feedback section</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.18" date="January 17, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>UI polish:</strong> Streamlined pack selection, tightened layout, less visual clutter</li>
              <li><strong>Custom Pack Builder:</strong> Sticky "Start" button stays visible with iOS keyboard, auto-focus for rapid bird entry, added preview tip</li>
              <li><strong>Help page:</strong> Reorganized sections, added creator attribution</li>
              <li><strong>Privacy page:</strong> Full privacy policy accessible from Settings</li>
              <li><strong>Analytics fix:</strong> Fixed gtag initialization pattern - tracking now works correctly</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.17" date="January 16, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Cookie consent:</strong> I know I'm a stranger, but please accept my cookies! It really helps me document how many players I have and which birds everyone loves. (GDPR-compliant banner now appears on first visit)</li>
              <li><strong>Privacy controls:</strong> Changed your mind? New "Analytics Cookies" toggle in Settings lets you opt in/out anytime</li>
              <li><strong>Your data is safe:</strong> IP anonymization enabled, secure cookie flags set, full GDPR/CCPA compliance - I promise I'm just adding bird nerds to my LIFE LIST, not stalking you</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.16" date="January 16, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Bird Reference enhancement:</strong> Separated display species (40) from gameplay rotation (28) for Eastern Birds pack - Bird Reference now shows all available species for preview</li>
              <li><strong>UI improvements:</strong> Streamlined pack selection tips, improved Help page tips with confusion matrix mention</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.15" date="January 16, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Xeno-canto attribution:</strong> All Xeno-canto recordings now display recordist names for legal compliance (355 recordings attributed to 87+ contributors)</li>
              <li><strong>Help page enhancements:</strong> Added "Why Learn Bird Song?" section explaining the educational value of left/right audio training, tech details about PWA offline caching</li>
              <li><strong>Audio curation:</strong> Extensive clip review and quality improvements - refined canonical clips, updated vocalization types (call/song/drum), removed low-quality recordings</li>
              <li><strong>UI improvements:</strong> Moved shuffle button above bird grid for better visibility, added "Coming Soon" banner to Stats screen to clarify demo data</li>
              <li><strong>New bird icons:</strong> Added icons for upcoming Macaulay species (ACFL, EAPH, EWPE, WEVI)</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.14" date="January 15, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Analytics:</strong> Added Google Analytics 4 tracking for usage insights (page views, pack/level selections, Training Mode adoption)</li>
              <li><strong>Data fixes:</strong> Restored BCCH, MODO, and WBNU clips lost during Cornell CD processing</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.13" date="January 15, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Western Birds pack:</strong> 14 new species including Steller's Jay, California Scrub-Jay, Black-capped Chickadee, and more. Fixed to use 9 random birds per round.</li>
              <li><strong>Audio improvements:</strong> Restored canonical clips for 71+ species, resolved 202 broken audio references, cleaned up duplicate EATO clips (11→5)</li>
              <li><strong>UI refinements:</strong> Black backgrounds on Training Mode labels for better readability, Warbler Academy icon updated to Blackburnian Warbler, improved loading indicators</li>
              <li><strong>Bird Reference enhancements:</strong> Collapsible packs with expand/collapse controls, source badges (Xeno-canto, Cornell, contributors), pack cards with representative bird icons</li>
              <li><strong>Fixed blank spectrograms</strong> (async texture loading), added pull-to-refresh on main menu, audio preloading on preview screen</li>
              <li>Added White-crowned Sparrow to Sparrows pack (now 9 species)</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.03" date="January 17, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Quit button:</strong> Added X button during gameplay to quit rounds early with confirmation</li>
              <li><strong>Support section:</strong> Added Ko-fi donation link and encouragement to support Cornell Macaulay Library and Xeno-Canto</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.02" date="January 17, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Mobile navigation fix:</strong> Bottom menu icons now properly visible on both Safari and Chrome mobile browsers</li>
              <li><strong>Fullscreen tip:</strong> Added browser guidance for best mobile experience</li>
              <li><strong>PWA improvements:</strong> Enhanced Apple mobile web app support</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="2.0" date="January 12, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li>Rebranded to ChipNotes! with Owl Professor mascot</li>
              <li>Training Mode: Toggle eye icon to show bird labels on tiles</li>
              <li>Warbler Academy pack: 33 wood-warbler species for experts</li>
              <li>Complete icon set: Hand-illustrated icons for all 91+ species</li>
              <li>Added Eastern Towhee to Expanded Backyard pack</li>
              <li>Birds now persist between rounds by default</li>
              <li>Fixed scoring to allow full 100 points as documented</li>
              <li>iOS audio improvements and playback fixes</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="1.0" date="January 11, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li>Initial release with 6 bird packs</li>
              <li>Pre-round preview screen to hear and see birds before playing</li>
              <li>Custom pack builder for targeted practice</li>
              <li>Continuous play mode (untimed, relaxed practice)</li>
              <li>Enhanced round summary with per-species breakdown</li>
              <li>Progressive difficulty: 6 levels per pack</li>
              <li>Real spectrograms for visual learning</li>
              <li>PWA support for offline play and mobile installation</li>
            </ul>
          </VersionEntry>
        </Section>
        </div>

        {/* Spacer to prevent floating buttons from covering content */}
        <div style={{ height: '120px' }} />

      </div>

      {/* Floating buttons - visible after scroll */}
      {hasScrolled && (
        <>
          {/* Back button - bottom left */}
          <button
            onClick={() => location.state?.fromPackSelect ? navigate('/pack-select') : navigate(-1)}
            style={{
              position: 'fixed',
              bottom: 'calc(24px + var(--safe-area-bottom, 0px))',
              left: '24px',
              padding: '6px 10px',
              fontSize: '11px',
              fontWeight: 600,
              background: 'rgba(255, 152, 0, 0.15)',
              color: 'var(--color-accent)',
              border: '1px solid rgba(255, 152, 0, 0.3)',
              borderRadius: '12px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              zIndex: 1000,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.background = 'rgba(255, 152, 0, 0.25)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.background = 'rgba(255, 152, 0, 0.15)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
            }}
            aria-label="Back"
          >
            <span style={{ fontSize: '12px' }}>←</span>
            Back
          </button>

          {/* Expand/Collapse All button */}
          <button
            onClick={toggleAll}
            style={{
              position: 'fixed',
              bottom: 'calc(24px + var(--safe-area-bottom, 0px))',
              right: '24px',
              padding: '6px 10px',
              fontSize: '11px',
              fontWeight: 600,
              background: 'rgba(255, 152, 0, 0.15)',
              color: 'var(--color-accent)',
              border: '1px solid rgba(255, 152, 0, 0.3)',
              borderRadius: '12px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              zIndex: 1000,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.background = 'rgba(255, 152, 0, 0.25)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.background = 'rgba(255, 152, 0, 0.15)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
            }}
          >
            <span style={{ fontSize: '12px' }}>
              {allExpanded ? '▲' : '▼'}
            </span>
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </button>
        </>
      )}
    </div>
  );
}

function Section({ id, title, children, isExpanded, onToggle }: {
  id?: string;
  title: string;
  children: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div id={id} style={{ marginBottom: '16px', scrollMarginTop: '20px' }}>
      <h3
        onClick={onToggle}
        style={{
          fontSize: '16px',
          fontWeight: 600,
          marginBottom: isExpanded ? '12px' : '0',
          color: 'var(--color-accent)',
          borderBottom: '1px solid var(--color-surface)',
          paddingBottom: '8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'color 0.2s',
          userSelect: 'none',
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = '#FFA726'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-accent)'}
      >
        <span style={{
          fontSize: '14px',
          width: '14px',
          textAlign: 'center',
          flexShrink: 0
        }}>
          {isExpanded ? '▼' : '▶'}
        </span>
        {title}
      </h3>
      {isExpanded && (
        <div style={{ fontSize: '15px', lineHeight: 1.6, color: 'var(--color-text)' }}>
          {children}
        </div>
      )}
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

function VersionEntry({ version, date, children }: { version: string; date: string; children: React.ReactNode }) {
  return (
    <div style={{
      marginBottom: '16px',
      padding: '12px',
      background: 'var(--color-surface)',
      borderRadius: '8px',
      borderLeft: '3px solid var(--color-accent)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--color-accent)' }}>v{version}</span>
        <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{date}</span>
      </div>
      {children}
    </div>
  );
}

function HomeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

export default Help;
