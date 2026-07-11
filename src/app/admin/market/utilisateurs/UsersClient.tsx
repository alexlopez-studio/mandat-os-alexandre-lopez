'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Shield, UserPlus, KeyRound, Trash2, Loader2, ShieldCheck, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

type AdminRole = 'super_admin' | 'admin'
type AdminUser = {
  id: string
  email: string
  full_name: string | null
  role: AdminRole
  is_active: boolean
  user_id: string | null
  created_at: string
}

export function UsersClient({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)

  // Modal création
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ email: '', full_name: '', role: 'admin' as AdminRole, password: '' })
  const [saving, setSaving] = useState(false)

  // Modal reset
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur')
      setUsers(json.users as AdminUser[])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function createUser() {
    if (!form.email.trim() || form.password.length < 8) {
      toast.error('Email requis et mot de passe ≥ 8 caractères')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur')
      toast.success('Administrateur créé')
      setCreateOpen(false)
      setForm({ email: '', full_name: '', role: 'admin', password: '' })
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  async function patchUser(id: string, patch: Partial<Pick<AdminUser, 'role' | 'is_active'>>) {
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    }
  }

  async function deleteUser(u: AdminUser) {
    if (!confirm(`Supprimer définitivement ${u.email} ?`)) return
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur')
      toast.success('Administrateur supprimé')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    }
  }

  async function doReset() {
    if (!resetTarget || newPassword.length < 8) {
      toast.error('Mot de passe ≥ 8 caractères')
      return
    }
    try {
      const res = await fetch(`/api/admin/users/${resetTarget.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur')
      toast.success(`Mot de passe réinitialisé pour ${resetTarget.email}`)
      setResetTarget(null)
      setNewPassword('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Shield className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold leading-tight">Utilisateurs</h1>
          <p className="text-xs text-muted-foreground">Gestion des accès au back-office</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <UserPlus className="mr-1.5 h-4 w-4" /> Ajouter un admin
        </Button>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Utilisateur</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="py-12 text-center text-muted-foreground">Chargement…</TableCell></TableRow>
            ) : users.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="py-12 text-center text-muted-foreground">Aucun administrateur.</TableCell></TableRow>
            ) : (
              users.map((u) => {
                const isSelf = u.id === currentUserId
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-medium">{u.full_name || u.email.split('@')[0]}{isSelf && <span className="ml-1.5 text-xs text-muted-foreground">(vous)</span>}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </TableCell>
                    <TableCell>
                      <Select value={u.role} onValueChange={(v) => patchUser(u.id, { role: v as AdminRole })} disabled={isSelf}>
                        <SelectTrigger className="h-8 w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="super_admin"><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Super admin</span></SelectItem>
                          <SelectItem value="admin"><span className="inline-flex items-center gap-1.5"><User className="h-3.5 w-3.5" />Admin</span></SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <button onClick={() => !isSelf && patchUser(u.id, { is_active: !u.is_active })} disabled={isSelf}>
                        <Badge className={u.is_active ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}>
                          {u.is_active ? 'Actif' : 'Désactivé'}
                        </Badge>
                      </button>
                      {!u.user_id && <div className="mt-0.5 text-[11px] text-amber-600">jamais connecté</div>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Réinitialiser le mot de passe" onClick={() => setResetTarget(u)}>
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                        {!isSelf && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" title="Supprimer" onClick={() => deleteUser(u)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Création */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nouvel administrateur</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email *</span>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="admin@email.fr" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nom complet</span>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Jean Dupont" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rôle</span>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AdminRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super_admin">Super admin</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mot de passe temporaire *</span>
              <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="8 caractères minimum" />
              <span className="text-[11px] text-muted-foreground">À communiquer à l’utilisateur ; il pourra le changer ensuite.</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={createUser} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password */}
      <Dialog open={!!resetTarget} onOpenChange={(o) => !o && setResetTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Réinitialiser le mot de passe</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{resetTarget?.email}</p>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nouveau mot de passe</span>
            <Input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="8 caractères minimum" />
          </label>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetTarget(null)}>Annuler</Button>
            <Button onClick={doReset}>Réinitialiser</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
