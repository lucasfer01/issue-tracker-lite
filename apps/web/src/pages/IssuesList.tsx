import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api/client';

export default function IssuesList() {
  const { projectId } = useParams();
  const [status, setStatus] = useState<string>('');
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['issues', projectId, status, q, cursor],
    queryFn: () => api.listIssues(projectId!, { status, q, cursor, limit: 10 }),
  });

  if (isLoading) return <p>Cargando...</p>;
  if (error) return <p>Error al cargar issues</p>;

  return (
    <div style={{ maxWidth: 800, margin: '20px auto' }}>
      <h1>Issues</h1>
      <div>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">(todos)</option>
          <option value="OPEN">OPEN</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="BLOCKED">BLOCKED</option>
          <option value="DONE">DONE</option>
        </select>
        <input placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} />
        <button onClick={() => { setCursor(null); refetch(); }}>Filtrar</button>
      </div>
      <ul>
        {data?.items.map((it) => (
          <li key={it.id}>
            <Link to={`/issues/${it.id}`}>#{it.number} {it.title} ({it.status})</Link>
          </li>
        ))}
      </ul>
      {data?.nextCursor && <button onClick={() => setCursor(data.nextCursor)}>Load more</button>}
    </div>
  );
}
