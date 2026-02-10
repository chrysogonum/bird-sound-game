import { useNavigate, Link } from 'react-router-dom';

const REGIONS = [
  {
    id: 'na',
    name: 'North America',
    route: '/na-packs',
    summary: '120 species · 8 packs',
    tagline: 'Warblers, sparrows, woodpeckers & more',
    bg: 'rgba(245, 166, 35, 0.18)',
    accentColor: '#f5a623',
    titleColor: '#f5c87a',
    icon: 'NOCA',
    preview: ['BLJA', 'CARW', 'EATO', 'AMRO', 'RWBL'],
  },
  {
    id: 'eu',
    name: 'Europe',
    route: '/eu-packs',
    summary: '61 species · 4 packs',
    tagline: 'Skulkers, raptors & woodland birds',
    bg: 'rgba(160, 180, 80, 0.18)',
    accentColor: '#a0b450',
    titleColor: '#c8d8a2',
    icon: 'EURO',
    preview: ['eurwar1', 'combuz1', 'redkit1', 'firecr1', 'eugori2'],
  },
  {
    id: 'nz',
    name: 'New Zealand',
    route: '/nz-packs',
    summary: '37 species · 4 packs',
    tagline: 'Unique island birds & native species',
    bg: 'rgba(100, 200, 180, 0.18)',
    accentColor: '#4db6ac',
    titleColor: '#a8d8cc',
    icon: 'yeepen1',
    preview: ['tui1', 'nezbel1', 'nezfan1', 'morepo2', 'weka1'],
  },
];

function PackSelect() {
  const navigate = useNavigate();

  return (
    <div className="screen" style={{ paddingBottom: '24px' }}>
      {/* Header */}
      <div className="flex-row items-center gap-md" style={{ marginBottom: '20px' }}>
        <button className="btn-icon" onClick={() => navigate('/')} aria-label="Home" style={{ color: 'var(--color-text-muted)' }}>
          <HomeIcon />
        </button>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--color-text)', opacity: 0.9 }}>Bird Packs</h2>
      </div>

      <div style={{
        fontSize: '14px',
        color: 'var(--color-text-muted)',
        marginBottom: '20px',
        lineHeight: 1.6,
        background: 'rgba(70, 70, 90, 0.5)',
        padding: '16px',
        borderRadius: '12px',
      }}>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li style={{ fontWeight: 600 }}>Best on a phone/tablet, with 🎧</li>
          <li>No sound? Check if 📱 is on silent 🔇→🔊</li>
          <li>6 levels—start @ #1, young Grasshopper <img src={`${import.meta.env.BASE_URL}data/icons/SAVS.png`} alt="" style={{ width: '18px', height: '18px', verticalAlign: 'middle', marginLeft: '2px', borderRadius: '3px' }} /></li>
          <li>Try training mode (👁){' '}
            <Link to="/help#training-mode" state={{ fromPackSelect: true }} style={{ color: 'var(--color-accent)' }}>
              Help →
            </Link>
          </li>
          <li>Timer anxiety? Use Continuous Play{' '}
            <Link to="/settings" state={{ fromPackSelect: true }} style={{ color: 'var(--color-accent)' }}>
              🧘 ⚙️
            </Link>
          </li>
        </ul>
      </div>

      {/* Region cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {REGIONS.map((region) => (
          <button
            key={region.id}
            onClick={() => navigate(region.route)}
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              padding: '14px 20px',
              background: region.bg,
              borderRadius: '14px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = `0 4px 16px rgba(0,0,0,0.2)`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {/* Top row: icon + title + chevron */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <img
                src={`${import.meta.env.BASE_URL}data/icons/${region.icon}.png`}
                alt=""
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  flexShrink: 0,
                  boxShadow: `0 2px 8px rgba(0,0,0,0.3)`,
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '18px', color: region.titleColor, fontWeight: 600 }}>
                  {region.name}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  {region.summary}
                </div>
              </div>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={region.accentColor} strokeWidth="3" style={{ opacity: 1, flexShrink: 0 }}>
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
            {/* Tagline */}
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', opacity: 0.8, paddingLeft: '70px' }}>
              {region.tagline}
            </div>
            {/* Preview bird avatars */}
            <div style={{ display: 'flex', gap: '0px', paddingLeft: '70px' }}>
              {region.preview.map((code, i) => (
                <img
                  key={code}
                  src={`${import.meta.env.BASE_URL}data/icons/${code}.png`}
                  alt=""
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid rgba(0,0,0,0.4)',
                    marginLeft: i === 0 ? 0 : '-4px',
                  }}
                />
              ))}
            </div>
          </button>
        ))}
      </div>

      {/* Custom Pack */}
      <button
        onClick={() => navigate('/custom-pack')}
        style={{
          width: '100%',
          marginTop: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '16px 20px',
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: '14px',
          border: '1px dashed rgba(255, 255, 255, 0.15)',
          cursor: 'pointer',
          transition: 'all 0.2s',
          textAlign: 'left',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        }}
      >
        <div style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '22px',
          color: 'var(--color-text-muted)',
          flexShrink: 0,
        }}>
          +
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', opacity: 0.8 }}>
            Custom Pack
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            Mix birds from any region
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.3, flexShrink: 0 }}>
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
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

export default PackSelect;
