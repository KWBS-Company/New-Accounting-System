import { ChangeEvent, FormEvent, useRef, useState } from 'react'
import { Camera, Loader2, ShieldCheck, User } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { extractApiError } from '@/api/client'
import { profileApi } from '@/api/profile'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PasswordInput } from '@/components/common/PasswordInput'
import { PASSWORD_HINT, PASSWORD_MIN_LENGTH, passwordIssues } from '@/lib/validators'

/**
 * Profile page — three independent sections:
 *  1) Avatar upload  (POST /auth/avatar, multipart)
 *  2) Personal info  (PATCH /auth/profile)
 *  3) Change password (POST /auth/change-password)
 */
export default function Profile() {
  const { user, refresh } = useAuth()
  const { toast } = useToast()

  const initials =
    (user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '') || '?'

  // ---- Avatar upload ----
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const onAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast('Please choose an image file', 'error')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast('Image must be under 5MB', 'error')
      return
    }
    setUploading(true)
    try {
      await profileApi.uploadAvatar(file)
      await refresh()
      toast('Profile photo updated', 'success')
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // ---- Profile info ----
  const [form, setForm] = useState({
    firstName: user?.firstName ?? '',
    lastName:  user?.lastName  ?? '',
    phone:     user?.phone     ?? '',
  })
  const [savingProfile, setSavingProfile] = useState(false)

  const onProfileSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      await profileApi.updateProfile({
        firstName: form.firstName,
        lastName:  form.lastName,
        phone:     form.phone || undefined,
      })
      await refresh()
      toast('Profile updated', 'success')
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  // ---- Change password ----
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' })
  const [savingPwd, setSavingPwd] = useState(false)

  const pwdIssues = pwd.next ? passwordIssues(pwd.next) : []
  const pwdMismatch =
    !!pwd.next && !!pwd.confirm && pwd.next !== pwd.confirm

  const onPwdSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (pwdIssues.length) {
      toast('New password is too weak', 'error')
      return
    }
    if (pwdMismatch) {
      toast('New passwords do not match', 'error')
      return
    }
    setSavingPwd(true)
    try {
      await profileApi.changePassword({
        currentPassword: pwd.current,
        newPassword:     pwd.next,
      })
      toast('Password changed', 'success')
      setPwd({ current: '', next: '', confirm: '' })
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setSavingPwd(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Profile."
        subtitle="Update your details and security."
      />

      <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-4xl mx-auto space-y-6">
        {/* ===== Avatar ===== */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Camera className="h-5 w-5 text-primary" />
              Profile photo
            </CardTitle>
            <CardDescription>
              Upload a square image — JPG, PNG, or WebP, under 5MB.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={(user as any)?.avatarUrl} />
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onAvatarChange}
              />
              <Button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                variant="outline"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4" />
                    Choose image
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Image is uploaded to the server and shown in the sidebar.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ===== Personal info ===== */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <User className="h-5 w-5 text-primary" />
              Personal info
            </CardTitle>
            <CardDescription>
              These appear on vouchers and reports you generate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onProfileSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    required
                    value={form.firstName}
                    onChange={(e) =>
                      setForm({ ...form, firstName: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    required
                    value={form.lastName}
                    onChange={(e) =>
                      setForm({ ...form, lastName: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={user?.email ?? ''} disabled />
                <p className="text-xs text-muted-foreground">
                  Contact support to change your email.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+977 9800000000"
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={savingProfile}>
                  {savingProfile ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ===== Change password ===== */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Change password
            </CardTitle>
            <CardDescription>{PASSWORD_HINT}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onPwdSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="current">Current password</Label>
                <PasswordInput
                  id="current"
                  required
                  autoComplete="current-password"
                  value={pwd.current}
                  onChange={(e) => setPwd({ ...pwd, current: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="next">New password</Label>
                <PasswordInput
                  id="next"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  autoComplete="new-password"
                  value={pwd.next}
                  onChange={(e) => setPwd({ ...pwd, next: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm new password</Label>
                <PasswordInput
                  id="confirm"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  autoComplete="new-password"
                  value={pwd.confirm}
                  onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
                />
                {pwdMismatch && (
                  <p className="text-xs text-destructive">
                    Passwords don't match.
                  </p>
                )}
              </div>
              {pwd.next && pwdIssues.length > 0 && (
                <ul className="text-xs text-muted-foreground space-y-0.5 pl-4 list-disc">
                  {pwdIssues.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              )}
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={savingPwd || pwdIssues.length > 0 || pwdMismatch}
                >
                  {savingPwd ? 'Updating…' : 'Update password'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
