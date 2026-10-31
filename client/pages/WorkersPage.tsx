import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, MapPin, Search, Star, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { supabase } from "../lib/supabase";
import { useHotelTenant } from "../lib/hotelTenant";

type Provider = {
  profile_id: string;
  full_name: string | null;
  service_type: string | null;
  location: string | null;
  profile_picture: string | null;
  professional_summary: string;
  specialties: string[];
  years_experience: number | null;
  completed_task_count: number;
  average_rating: number;
  review_count: number;
  testimonials: Array<{ rating: number; testimonial: string; reviewer_name: string; created_at: string }>;
};

const WorkersPage = () => {
  const { tenant, loading: tenantLoading } = useHotelTenant();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (tenantLoading) return;
    if (!tenant?.organizationId) {
      setIsLoading(false);
      setLoadError("Worker discovery is available from a hotel workspace.");
      return;
    }

    let active = true;
    setIsLoading(true);
    supabase.rpc("get_worker_directory", {
      target_organization_id: tenant.organizationId,
    }).then(({ data, error }) => {
      if (!active) return;
      if (error) {
        console.error("Unable to load worker directory:", error);
        setLoadError("You need hotel manager access to browse workers.");
        setProviders([]);
      } else {
        setLoadError("");
        setProviders((data || []) as Provider[]);
      }
      setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [tenant?.organizationId, tenantLoading]);

  const filteredProviders = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return providers;
    return providers.filter((provider) => [
      provider.full_name,
      provider.service_type,
      provider.location,
      provider.professional_summary,
      ...(provider.specialties || []),
    ].some((value) => value?.toLowerCase().includes(normalizedSearch)));
  }, [providers, search]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-sheraton-cream via-white to-sheraton-pearl">
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-medium text-sheraton-navy">
              <Briefcase className="h-4 w-4" /> {tenant?.name || "Hotel workspace"}
            </p>
            <h1 className="text-3xl font-bold text-sheraton-navy">Worker Directory</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">Find opted-in external vendors for hotel work. Ratings and completed tasks shown here are from this hotel.</p>
          </div>
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search workers"
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search service, specialty, location"
            />
          </div>
        </div>

        {loadError && (
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardContent className="p-5 text-sm text-amber-900">{loadError}</CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="grid gap-5 md:grid-cols-2">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-64 animate-pulse rounded-xl bg-white/80" />)}
          </div>
        ) : !loadError && filteredProviders.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center p-10 text-center">
              <UserRound className="mb-3 h-10 w-10 text-muted-foreground" />
              <h2 className="font-semibold text-sheraton-navy">{providers.length ? "No matching workers" : "No listed workers yet"}</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">{providers.length ? "Try a different service or specialty." : "External vendors can opt in from their profile. You can still create a task and assign internal staff."}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {filteredProviders.map((provider) => {
              const initials = (provider.full_name || "Worker").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
              return (
                <Card key={provider.profile_id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-14 w-14">
                        <AvatarImage src={provider.profile_picture || undefined} alt="" />
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-lg">{provider.full_name || "Worker"}</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">{provider.service_type || "External vendor"}</p>
                        {provider.location && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{provider.location}</p>}
                      </div>
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-1 font-semibold text-sheraton-navy"><Star className="h-4 w-4 fill-sheraton-gold text-sheraton-gold" />{Number(provider.average_rating).toFixed(1)}</div>
                        <p className="text-xs text-muted-foreground">{provider.review_count} reviews</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {(provider.specialties || []).map((specialty) => <Badge key={specialty} variant="secondary">{specialty}</Badge>)}
                      {provider.years_experience != null && <Badge variant="outline">{provider.years_experience} years experience</Badge>}
                      <Badge variant="outline">{provider.completed_task_count} completed tasks here</Badge>
                    </div>
                    {provider.professional_summary && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{provider.professional_summary}</p>}
                    {provider.testimonials?.length > 0 && (
                      <div className="space-y-2 border-t pt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent manager feedback</p>
                        {provider.testimonials.slice(0, 2).map((review, index) => (
                          <blockquote key={`${review.created_at}-${index}`} className="border-l-2 border-sheraton-gold pl-3 text-sm text-muted-foreground">
                            <span className="mr-2 font-medium text-sheraton-navy">{review.rating}/5</span>{review.testimonial}
                            <footer className="mt-1 text-xs">— {review.reviewer_name}, {new Date(review.created_at).toLocaleDateString()}</footer>
                          </blockquote>
                        ))}
                      </div>
                    )}
                    <Button asChild className="w-full">
                      <Link to={`/tasks/new?workerId=${encodeURIComponent(provider.profile_id)}`}>Assign to a task</Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
};

export default WorkersPage;
