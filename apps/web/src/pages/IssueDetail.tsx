import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useState } from 'react';

export default function IssueDetail() {
  const { issueId } = useParams();
  const qc = useQueryClient();

  const { data: issue, isLoading, error } = useQuery({ queryKey: ['issue', issueId], queryFn: () => api.getIssue(issueId!) });
  const { data: comments } = useQuery({ queryKey: ['comments', issueId], queryFn: () => api.listComments(issueId!) });

  const [status, setStatus] = useState('IN_PROGRESS');
  const [commentBody, setCommentBody] = useState('');

  const patch = useMutation({
    mutationFn: (data: any) => api.patchIssue(issueId!, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['issue', issueId] }),
  });

  const addComment = useMutation({
    mutationFn: () => api.addComment(issueId!, commentBody),
    onSuccess: () => { setCommentBody(''); qc.invalidateQueries({ queryKey: ['comments', issueId] }); },
  });

  if (isLoading) return <p>Cargando...</p>;
  if (error) return <p>Error al cargar issue</p>;

  return (
    <div style={{ maxWidth: 800, margin: '20px auto' }}>
      <h1>#{issue.number} {issue.title}</h1>
      <p>{issue.description}</p>
      <p>Status: {issue.status} | Priority: {issue.priority}</p>
      <button onClick={() => patch.mutate({ version: issue.version, status })}>Cambiar status</button>

      <h3>Comentarios</h3>
      <ul>
        {comments?.map((c: any) => (
          <li key={c.id}>{c.body}</li>
        ))}
      </ul>
      <input placeholder="Comentario" value={commentBody} onChange={(e) => setCommentBody(e.target.value)} />
      <button onClick={() => addComment.mutate()} disabled={!commentBody}>Agregar</button>
    </div>
  );
}
