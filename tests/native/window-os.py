import ctypes as C,json,sys,time
from ctypes import wintypes as W
pid=int(sys.argv[1]);mode=sys.argv[2];needle=sys.argv[3] if len(sys.argv)>3 else ''
u=C.WinDLL('user32',use_last_error=True)
u.SetProcessDpiAwarenessContext.argtypes=[C.c_void_p];u.SetProcessDpiAwarenessContext(C.c_void_p(-4))
u.GetWindowThreadProcessId.argtypes=[W.HWND,C.POINTER(W.DWORD)]
u.GetWindowRect.argtypes=[W.HWND,C.POINTER(W.RECT)]
u.GetWindowLongPtrW.argtypes=[W.HWND,C.c_int];u.GetWindowLongPtrW.restype=C.c_ssize_t
u.ShowWindow.argtypes=[W.HWND,C.c_int];u.PostMessageW.argtypes=[W.HWND,W.UINT,W.WPARAM,W.LPARAM]
u.SetWindowPos.argtypes=[W.HWND,W.HWND,C.c_int,C.c_int,C.c_int,C.c_int,W.UINT]
rows=[]
@C.WINFUNCTYPE(W.BOOL,W.HWND,W.LPARAM)
def visit(h,_):
 owner=W.DWORD();u.GetWindowThreadProcessId(h,C.byref(owner));s=C.create_unicode_buffer(256);u.GetWindowTextW(h,s,256)
 if owner.value==pid and s.value.startswith('Local Music'):
  rect=W.RECT();u.GetWindowRect(h,C.byref(rect));rows.append(dict(hwnd=h,title=s.value,visible=bool(u.IsWindowVisible(h)),minimized=bool(u.IsIconic(h)),topmost=bool(u.GetWindowLongPtrW(h,-20)&8),rect=[rect.left,rect.top,rect.right,rect.bottom]))
 return True
u.EnumWindows(visit,0)
if mode=='list':print(json.dumps(rows));sys.exit()
selected=[r for r in rows if needle in r['title']];assert len(selected)==1,(needle,rows)
h=selected[0]['hwnd']
if mode=='close':u.PostMessageW(h,0x10,0,0)
elif mode=='minimize':u.ShowWindow(h,6)
elif mode=='restore':u.ShowWindow(h,9)
elif mode=='resize':u.SetWindowPos(h,None,0,0,int(sys.argv[4]),int(sys.argv[5]),6)
else:raise ValueError(mode)
print(json.dumps(selected[0]))
