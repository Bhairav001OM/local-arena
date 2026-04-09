import { useState, useEffect } from "react";
import { motion } from "framer-motion"; 
import { Link } from "react-router-dom"; 
import { ArrowRight, Trophy, Users, MonitorPlay, Zap } from "lucide-react";
import { type Tournament, fetchTournaments } from "../data"; // Removed static GAMES import
import { TournamentCard } from "../components/TournamentCard";
import { supabase } from "../../utils/supabase.ts"; // Make sure this path points to your supabase.ts file!

export function Home() {
  const [upcomingTournaments, setUpcomingTournaments] = useState<Tournament[]>([]);
  const [platformGames, setPlatformGames] = useState<any[]>([]); // New state for your DB games

  useEffect(() => {
    // 1. Fetch static tournaments
    fetchTournaments().then(data => {
      setUpcomingTournaments(data.filter((t) => t.status === "upcoming").slice(0, 3));
    }).catch(console.error);

    // 2. Fetch dynamic games from your Supabase database
    const fetchGames = async () => {
      try {
        const { data, error } = await supabase
          .from('games')
          .select('*')
          .order('created_at', { ascending: false }); // Newest games show first

        if (error) throw error;
        if (data) setPlatformGames(data);
      } catch (err: any) {
        console.error("Failed to fetch games:", err.message);
      }
    };

    fetchGames();
  }, []);

  return (
    <div className="w-full bg-neutral-950 flex flex-col items-center justify-center pt-16 sm:pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <div className="relative isolate overflow-hidden bg-neutral-950 w-full max-w-7xl mx-auto rounded-3xl lg:flex lg:gap-x-20 lg:px-24 lg:pt-0">
        <svg
          viewBox="0 0 1024 1024"
          className="absolute left-1/2 top-1/2 -z-10 h-[64rem] w-[64rem] -translate-y-1/2 [mask-image:radial-gradient(closest-side,white,transparent)] sm:left-full sm:-ml-80 lg:left-1/2 lg:ml-0 lg:-translate-x-1/2 lg:translate-y-0"
          aria-hidden="true"
        >
          <circle cx={512} cy={512} r={512} fill="url(#759c1415-0410-454c-8f7c-9a820de03641)" fillOpacity="0.3" />
          <defs>
            <radialGradient id="759c1415-0410-454c-8f7c-9a820de03641">
              <stop stopColor="#d946ef" />
              <stop offset={1} stopColor="#06b6d4" />
            </radialGradient>
          </defs>
        </svg>

        <div className="mx-auto max-w-md text-center lg:mx-0 lg:flex-auto lg:py-32 lg:text-left z-10 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="mt-6 text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-6 leading-tight">
              Your Local <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 to-cyan-500 uppercase">
                Esports Hub
              </span>
            </h1>
            <p className="mt-4 text-lg leading-8 text-neutral-300 mb-8 font-light">
              Find, join, and host gaming tournaments in your local area. Prove you're the best player in town, win cash prizes, and connect with your local gaming community.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6 lg:justify-start">
              <Link
                to="/tournaments"
                className="rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-black shadow-sm hover:bg-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-all transform hover:scale-105 active:scale-95"
              >
                Find Tournaments
              </Link>
              <Link to="/host" className="text-sm font-semibold leading-6 text-white group flex items-center hover:text-fuchsia-400 transition-colors">
                Host Event <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </motion.div>
        </div>
        <div className="relative mt-16 h-80 lg:mt-8 z-10 hidden lg:block lg:w-[48rem]">
           <motion.img
            initial={{ opacity: 0, scale: 0.9, rotate: 2 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="absolute left-0 top-0 w-full max-w-none rounded-xl bg-white/5 ring-1 ring-white/10 shadow-2xl shadow-fuchsia-500/20 object-cover h-[400px]"
            src="https://images.unsplash.com/photo-1767455471543-055dbc6c6700?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlc3BvcnRzJTIwc3RhZ2UlMjBhcmVuYXxlbnwxfHx8fDE3NzI5OTkzODh8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
            alt="Esports Arena"
          />
        </div>
      </div>

      {/* Feature Section */}
      <div className="mx-auto mt-24 max-w-7xl px-6 sm:mt-32 lg:px-8 border-t border-neutral-900 pt-16">
        <div className="mx-auto max-w-2xl lg:text-center">
          <h2 className="text-base font-semibold leading-7 text-fuchsia-500 uppercase tracking-widest">Compete Locally</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Everything you need to compete
          </p>
          <p className="mt-6 text-lg leading-8 text-neutral-400">
            Whether you're looking to prove your skills, find a team, or organize your own local LAN party, we provide the platform to make it happen.
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
            {[
              {
                name: 'Find Matches',
                description: 'Discover local tournaments for your favorite games. Filter by game, location, date, and prize pool.',
                icon: MonitorPlay,
              },
              {
                name: 'Host Events',
                description: 'Easily set up and manage your own tournaments. Handle registration, brackets, and payouts securely.',
                icon: Trophy,
              },
              {
                name: 'Connect & Play',
                description: 'Build your local reputation. Form teams with players nearby and rise to the top of your city\'s leaderboard.',
                icon: Users,
              },
            ].map((feature, index) => (
              <motion.div 
                key={feature.name} 
                className="flex flex-col items-center text-center p-8 rounded-2xl bg-neutral-900/50 border border-neutral-800 hover:border-cyan-500/50 transition-colors"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/20 ring-1 ring-white/10">
                  <feature.icon className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                <dt className="flex items-center gap-x-3 text-xl font-bold leading-7 text-white mb-4">
                  {feature.name}
                </dt>
                <dd className="mt-1 flex flex-auto flex-col text-base leading-7 text-neutral-400">
                  <p className="flex-auto">{feature.description}</p>
                </dd>
              </motion.div>
            ))}
          </dl>
        </div>
      </div>

      {/* Featured Games (NOW RENDERED FROM SUPABASE DATABASE) */}
      <div className="w-full max-w-7xl mt-32 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-end mb-10">
          <div>
             <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Supported Games</h2>
             <p className="text-neutral-400">Find tournaments for the most popular competitive titles.</p>
          </div>
        </div>
        
        {platformGames.length === 0 ? (
          <p className="text-neutral-500 text-center py-10 border border-neutral-800 rounded-xl bg-neutral-900/30">
            No games found. Add some from your Admin panel!
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {platformGames.map((game, i) => (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group relative h-80 rounded-2xl overflow-hidden cursor-pointer"
              >
                {/* Changed to game.image_url to match Supabase */}
                <img src={game.image_url} alt={game.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-80" />
                <div className="absolute bottom-0 left-0 p-6 w-full">
                   <span className="inline-block px-3 py-1 mb-3 text-xs font-semibold uppercase tracking-wider text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 rounded-full">
                    {game.genre}
                   </span>
                   <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-fuchsia-400 transition-colors">{game.title}</h3>
                   <p className="text-neutral-300 text-sm line-clamp-2">{game.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Tournaments Preview */}
      <div className="w-full max-w-7xl mt-32 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-10">
          <div>
             <h2 className="text-3xl font-bold tracking-tight text-white mb-2 flex items-center">
               <Zap className="w-6 h-6 mr-3 text-fuchsia-500" /> Upcoming Battles
             </h2>
             <p className="text-neutral-400">Register now before spots fill up.</p>
          </div>
          <Link to="/tournaments" className="mt-4 sm:mt-0 text-cyan-400 hover:text-cyan-300 font-medium flex items-center group transition-colors">
            View all tournaments <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {upcomingTournaments.map((tournament) => (
            <TournamentCard key={tournament.id} tournament={tournament} />
          ))}
        </div>
      </div>
    </div>
  );
}