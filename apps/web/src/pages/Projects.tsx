import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function Projects() {
  const nav = useNavigate();
  const [key, setKey] = useState('DEMO2');
  const [name, setName] = useState('Nuevo Proyecto');
  const [creating, setCreating] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['projects'], queryFn: api.myProjects });

  const create = async () => {
    setCreating(true);
    try {
      await api.createProject(key, name);
      await refetch();
    } finally {
      setCreating(false);
    }
  };

  if (isLoading) return <p>Cargando...</p>;
  if (error) return <p>Error al cargar proyectos</p>;

  return (
    <div style={{ maxWidth: 800, margin: '20px auto' }}>
      <h1>Mis Proyectos</h1>
      <ul>
        {data?.map((p) => (
          <li key={p.id}>
            <strong>{p.key}</strong> - {p.name}
            <button style={{ marginLeft: 10 }} onClick={() => nav(`/projects/${p.id}/issues`)}>Entrar</button>
          </li>
        ))}
      </ul>
      <hr />
      <h2>Crear proyecto</h2>
      <input placeholder="KEY" value={key} onChange={(e) => setKey(e.target.value)} />
      <input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={create} disabled={creating}>Crear</button>
    </div>
  );
}
