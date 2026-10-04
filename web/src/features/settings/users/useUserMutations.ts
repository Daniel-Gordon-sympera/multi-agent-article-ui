/**
 * `/app/users*` (admin): list query and the create / update / reset-password mutations. Problem
 * details (409 self_protection, 409 email_exists, 422 weak_password…) surface in toasts.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createUser, listUsers, setUserPassword, updateUser } from "@/api/bff";
import { qk } from "@/api/keys";
import type { CreateUserInput, UpdateUserInput, User } from "@/api/types/bff";
import { toast } from "@/components/ui/sonner";
import { toastError } from "@/lib/errors";

export function isUserDisabled(user: Pick<User, "disabled" | "disabled_at">): boolean {
  return user.disabled === true || (user.disabled_at !== undefined && user.disabled_at !== null);
}

export function useUsers() {
  return useQuery({ queryKey: qk.app.users(), queryFn: listUsers, staleTime: 30_000 });
}

export function useUserMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.app.users() });

  const create = useMutation({
    mutationFn: (input: CreateUserInput) => createUser(input),
    onSuccess: (user) => {
      void refresh();
      toast.success("User created", {
        description: `${user.email} must change the temporary password at first sign-in.`,
      });
    },
    onError: (error) => toastError(error, "The user was not created"),
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) => updateUser(id, input),
    onSuccess: (user, variables) => {
      void refresh();
      const what =
        variables.input.disabled === true
          ? "disabled"
          : variables.input.disabled === false
            ? "re-enabled"
            : "updated";
      toast.success(`${user.email} ${what}`);
    },
    onError: (error) => toastError(error, "The user was not updated"),
  });

  const resetPassword = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      setUserPassword(id, password),
    onSuccess: () => {
      void refresh();
      toast.success("Password reset", {
        description: "The user must change it at the next sign-in; other sessions were ended.",
      });
    },
    onError: (error) => toastError(error, "The password was not reset"),
  });

  return { create, update, resetPassword };
}
