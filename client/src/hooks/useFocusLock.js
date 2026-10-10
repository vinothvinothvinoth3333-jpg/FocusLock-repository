import { useEffect, useRef } from 'react'
import socket from '../socket.js'

function useFocusLock(sprint) {
  const isAway = useRef(false)

  useEffect(() => {
    const shouldTrackVisibility =
      sprint?.status === 'running' ||
      (sprint?.status === 'paused' && sprint.mode === 'hardcore')

    if (!shouldTrackVisibility) {
      if (sprint?.status !== 'paused' || sprint.mode !== 'hardcore') {
        isAway.current = false
      }
      return undefined
    }
    if (sprint.status === 'running' && !sprint.endTime) {
      return undefined
    }

    let hiddenBeforeTrackingStarted = document.hidden

    function handleVisibilityChange() {
      if (document.hidden && hiddenBeforeTrackingStarted) return

      if (!document.hidden) {
        hiddenBeforeTrackingStarted = false
      }

      if (document.hidden && !isAway.current) {
        isAway.current = true
        socket.emit('user-distracted')
      } else if (!document.hidden && isAway.current) {
        isAway.current = false
        socket.emit('user-returned')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [sprint?.status, sprint?.mode, sprint?.endTime])
}

export default useFocusLock
