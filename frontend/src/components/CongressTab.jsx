/**
 * CongressTab.jsx
 * ---------------
 * Drop this into frontend/src/components/ and import it in Dashboard.jsx
 * to replace the inline congress tab code.
 *
 * Usage in Dashboard.jsx:
 *   import CongressTab from '../components/CongressTab';
 *   // In your tab rendering:
 *   {activeTab === 'congress' && <CongressTab />}
 */

import { useState, useEffect, useMemo } from 'react';
import api from '../lib/api';

// ---------------------------------------------------------------------------
// Styles (inline, dark-mode matching your existing theme)
// ---------------------------------------------------------------------------

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  clusterRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  clusterCard: {
    background: '#1a1f2e',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #2a2f3e',
  },
  clusterTitle: {
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '1px',
    marginBottom: '16px',
  },
  buyTitle: { color: '#4ade80' },
  sellTitle: { color: '#f87171' },
  clusterItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #2a2f3e',
  },
  tickerName: {
    fontWeight: 600,
    fontSize: '15px',
    color: '#e2e8f0',
  },
  sectorLabel: {
    fontSize: '12px',
    color: '#64748b',
    marginLeft: '8px',
  },
  memberName: {
    fontSize: '12px',
    color: '#94a3b8',
  },
  ratio: {
    textAlign: 'right',
    fontSize: '13px',
    fontWeight: 600,
  },
  tableCard: {
    background: '#1a1f2e',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #2a2f3e',
  },
  tableHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  tableTitle: {
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '1px',
    color: '#94a3b8',
  },
  filterRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  filterBtn: (active) => ({
    padding: '4px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
    background: active ? '#334155' : 'transparent',
    color: active ? '#e2e8f0' : '#64748b',
    transition: 'all 0.15s',
  }),
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.5px',
    color: '#64748b',
    borderBottom: '1px solid #2a2f3e',
    cursor: 'pointer',
    userSelect: 'none',
  },
  td: {
    padding: '10px 12px',
    fontSize: '13px',
    color: '#cbd5e1',
    borderBottom: '1px solid #1e2433',
  },
  buyBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600,
    background: 'rgba(74, 222, 128, 0.15)',
    color: '#4ade80',
  },
  sellBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600,
    background: 'rgba(248, 113, 113, 0.15)',
    color: '#f87171',
  },
  partyR: { color: '#f87171' },
  partyD: { color: '#60a5fa' },
  partyI: { color: '#a78bfa' },
  tickerLink: {
    color: '#38bdf8',
    fontWeight: 600,
    textDecoration: 'none',
    cursor: 'pointer',
  },
  paginationRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '12px',
  },
  pageBtn: (disabled) => ({
    padding: '6px 14px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: disabled ? 'default' : 'pointer',
    border: 'none',
    background: disabled ? '#1e2433' : '#334155',
    color: disabled ? '#475569' : '#e2e8f0',
    opacity: disabled ? 0.5 : 1,
  }),
  pageInfo: {
    fontSize: '12px',
    color: '#64748b',
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px',
    color: '#64748b',
    fontSize: '14px',
  },
};


// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

export default function CongressTab() {
  const [data, setData] = useState({ clusters: { buying: [], selling: [] }, trades: [] });
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'buy' | 'sell'
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch data
  useEffect(() => {
    async function fetchCongress() {
      try {
        const res = await api.get('/api/congress');
        setData(res.data);
      } catch (err) {
        console.error('Failed to fetch congress data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchCongress();
  }, []);

  // Filtered + sorted trades
  const processedTrades = useMemo(() => {
    let trades = [...(data.trades || [])];

    // Filter
    if (typeFilter !== 'all') {
      trades = trades.filter((t) => t.type === typeFilter);
    }

    // Sort
    trades.sort((a, b) => {
      const aVal = a[sortCol] || '';
      const bVal = b[sortCol] || '';
      if (sortDir === 'asc') return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    });

    return trades;
  }, [data.trades, typeFilter, sortCol, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(processedTrades.length / PAGE_SIZE));
  const pagedTrades = processedTrades.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [typeFilter]);

  function handleSort(col) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  }

  function partyColor(party) {
    if (party === 'Republican') return styles.partyR;
    if (party === 'Democrat') return styles.partyD;
    return styles.partyI;
  }

  function sortArrow(col) {
    if (sortCol !== col) return '';
    return sortDir === 'asc' ? ' \u25B2' : ' \u25BC';
  }

  if (loading) {
    return <div style={styles.emptyState}>Loading congressional trades...</div>;
  }

  const { buying = [], selling = [] } = data.clusters || {};

  return (
    <div style={styles.container}>
      {/* ---- Cluster cards ---- */}
      <div style={styles.clusterRow}>
        {/* Buy clusters */}
        <div style={styles.clusterCard}>
          <div style={{ ...styles.clusterTitle, ...styles.buyTitle }}>
            CLUSTER BUYING
            {buying.length > 0 ? ` \u2014 ${buying.length} TICKER${buying.length !== 1 ? 'S' : ''}` : ''}
          </div>
          {buying.length === 0 && (
            <div style={{ color: '#475569', fontSize: '13px' }}>No buy clusters detected</div>
          )}
          {buying.map((item) => (
            <div key={item.ticker} style={styles.clusterItem}>
              <div>
                <span style={styles.tickerName}>{item.ticker}</span>
                <div style={styles.memberName}>
                  {(item.recent_buyers || []).slice(0, 3).join(', ')}
                </div>
              </div>
              <div style={{ ...styles.ratio, color: '#4ade80' }}>
                {item.buys}B / {item.sells}S
              </div>
            </div>
          ))}
        </div>

        {/* Sell clusters */}
        <div style={styles.clusterCard}>
          <div style={{ ...styles.clusterTitle, ...styles.sellTitle }}>
            CLUSTER SELLING
            {selling.length > 0 ? ` \u2014 ${selling.length} TICKER${selling.length !== 1 ? 'S' : ''}` : ''}
          </div>
          {selling.length === 0 && (
            <div style={{ color: '#475569', fontSize: '13px' }}>No sell clusters detected</div>
          )}
          {selling.map((item) => (
            <div key={item.ticker} style={styles.clusterItem}>
              <div>
                <span style={styles.tickerName}>{item.ticker}</span>
                <div style={styles.memberName}>
                  {(item.recent_sellers || []).slice(0, 3).join(', ')}
                </div>
              </div>
              <div style={{ ...styles.ratio, color: '#f87171' }}>
                {item.buys}B / {item.sells}S
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---- Transactions table ---- */}
      <div style={styles.tableCard}>
        <div style={styles.tableHeader}>
          <div style={styles.tableTitle}>
            RECENT TRANSACTIONS ({processedTrades.length})
          </div>
          <div style={styles.filterRow}>
            {['all', 'buy', 'sell'].map((f) => (
              <button
                key={f}
                style={styles.filterBtn(typeFilter === f)}
                onClick={() => setTypeFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'buy' ? 'Buys' : 'Sells'}
              </button>
            ))}
          </div>
        </div>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th} onClick={() => handleSort('representative')}>
                MEMBER{sortArrow('representative')}
              </th>
              <th style={styles.th}>PARTY</th>
              <th style={styles.th} onClick={() => handleSort('ticker')}>
                TICKER{sortArrow('ticker')}
              </th>
              <th style={styles.th} onClick={() => handleSort('type')}>
                TYPE{sortArrow('type')}
              </th>
              <th style={styles.th} onClick={() => handleSort('date')}>
                DATE{sortArrow('date')}
              </th>
              <th style={styles.th} onClick={() => handleSort('amount')}>
                AMOUNT{sortArrow('amount')}
              </th>
              <th style={styles.th}>OWNER</th>
            </tr>
          </thead>
          <tbody>
            {pagedTrades.length === 0 && (
              <tr>
                <td colSpan={7} style={{ ...styles.td, textAlign: 'center', color: '#475569' }}>
                  No trades found
                </td>
              </tr>
            )}
            {pagedTrades.map((trade, i) => (
              <tr key={`${trade.ticker}-${trade.date}-${trade.representative}-${i}`}>
                <td style={styles.td}>
                  <div style={{ fontWeight: 500, color: '#e2e8f0' }}>
                    {trade.representative || '\u2014'}
                  </div>
                  {trade.chamber && trade.state && (
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      {trade.chamber} \u00B7 {trade.state}
                    </div>
                  )}
                </td>
                <td style={styles.td}>
                  <span style={partyColor(trade.party)}>
                    {trade.party ? trade.party.charAt(0) : '\u2014'}
                  </span>
                </td>
                <td style={styles.td}>
                  <span style={styles.tickerLink}>{trade.ticker}</span>
                  {trade.issuer && (
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{trade.issuer}</div>
                  )}
                </td>
                <td style={styles.td}>
                  <span style={trade.type === 'buy' ? styles.buyBadge : styles.sellBadge}>
                    {trade.type ? trade.type.toUpperCase() : '\u2014'}
                  </span>
                </td>
                <td style={styles.td}>{trade.date || '\u2014'}</td>
                <td style={styles.td}>
                  <span style={{ fontWeight: 500 }}>{trade.amount || '\u2014'}</span>
                </td>
                <td style={styles.td}>
                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                    {trade.owner || '\u2014'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={styles.paginationRow}>
            <button
              style={styles.pageBtn(currentPage <= 1)}
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              Previous
            </button>
            <span style={styles.pageInfo}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              style={styles.pageBtn(currentPage >= totalPages)}
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
