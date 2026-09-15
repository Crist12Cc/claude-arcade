'use client';
import { useState } from 'react';
const MIN_POKEMON_ID = 1;
const MAX_POKEMON_ID = 1025;
export default function PokemonCounterPage() {
  const [count, setCount] = useState(MIN_POKEMON_ID);
  const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${count}.png`;
  function step(delta: number): void {
    setCount((current) =>
      Math.min(MAX_POKEMON_ID, Math.max(MIN_POKEMON_ID, current + delta))
    );
  }
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-bold">Contador Pokémon</h1>
      <img
        key={count}
        src={spriteUrl}
        alt={`Pokémon #${count}`}
        width={200}
        height={200}
        className="object-contain"
      />
      <p className="text-xl font-mono">#{count}</p>
      <div className="flex gap-4">
        <button
          onClick={() => step(-1)}
          className="rounded-lg bg-neutral-700 px-4 py-2 text-white hover:bg-neutral-600"
        >
          -1
        </button>
        <button
          onClick={() => step(1)}
          className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-500"
        >
          +1
        </button>
      </div>
    </main>
  );
}
