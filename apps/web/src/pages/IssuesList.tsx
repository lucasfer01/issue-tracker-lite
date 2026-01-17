import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api/client';

export default function IssuesList() {
  const { projectId } = useParams();
  const [status, setStatus] = useState<string>('');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);

  const qc = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['issues', projectId, status, assigneeId, q, cursor],
    queryFn: () => api.listIssues(projectId!, { status, assigneeId, q, cursor, limit: 10 }),
  });

  const createIssue = useMutation({
    mutationFn: (data: { title: string; description?: string; priority?: string }) => api.createIssue(projectId!, data),
    onSuccess: () => {
      setCursor(null);
      qc.invalidateQueries({ queryKey: ['issues', projectId] });
    },
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
        <input placeholder="Assignee Id" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} />
        <input placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} />
        <button onClick={() => { setCursor(null); refetch(); }}>Filtrar</button>
      </div>
      <div style={{ marginTop: 10 }}>
        <strong>Nuevo Issue:</strong>
        <NewIssueForm
          onCreate={(title, description, priority) => createIssue.mutate({ title, description, priority })}
          creating={createIssue.isPending}
        />
      </div>
      <ul>
        {data?.items.map((it) => (
          <li key={it.id}>
            <Link to={`/issues/${it.id}`}>#{it.number} {it.title} ({it.status})</Link>
          </li>
        ))}
      </ul>
      {data && data.items.length === 0 && <p>Sin resultados</p>}
      {data?.nextCursor && <button onClick={() => setCursor(data.nextCursor)}>Load more</button>}
    </div>
  );
}

function NewIssueForm({ onCreate, creating }: { onCreate: (title: string, description?: string, priority?: string) => void; creating: boolean }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input placeholder="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} />
      <select value={priority} onChange={(e) => setPriority(e.target.value)}>
        <option value="LOW">LOW</option>
        <option value="MEDIUM">MEDIUM</option>
        <option value="HIGH">HIGH</option>
        <option value="URGENT">URGENT</option>
      </select>
      <button onClick={() => onCreate(title, description, priority)} disabled={creating || !title}>
        {creating ? 'Creando...' : 'New Issue'}
      </button>
    </div>
  );
}
